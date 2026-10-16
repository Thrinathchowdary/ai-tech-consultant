"""Resumable, rate-limited sitemap ingestion for support articles."""

import argparse
import hashlib
import json
import time
from pathlib import Path
from typing import Dict, Iterable, List
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.retrieval import KnowledgeBase

DEFAULT_SITEMAP = "https://support.brilliantdirectories.com/support/sitemap.xml"


def load_state(path: Path) -> Dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"completed": [], "failed": [], "discovered": [], "last_url": None}


def save_state(path: Path, state: Dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def discover_urls(xml: str) -> List[str]:
    soup = BeautifulSoup(xml, "xml")
    return list(dict.fromkeys(loc.get_text(strip=True) for loc in soup.find_all("loc")))


def split_text(text: str, size: int = 900, overlap: int = 120) -> Iterable[str]:
    words = text.split()
    step = max(1, size - overlap)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start : start + size])
        if chunk:
            yield chunk
        if start + size >= len(words):
            break


def extract_chunks(url: str, html: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup(["script", "style", "noscript"]):
        element.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else url
    text = " ".join(soup.get_text(" ", strip=True).split())
    chunks = []
    for index, content in enumerate(split_text(text)):
        chunks.append({
            "id": hashlib.sha1(f"{url}:{index}".encode("utf-8")).hexdigest(),
            "url": url,
            "title": title,
            "text": content,
            "kind": "article",
        })
    for image in soup.find_all("img"):
        source = image.get("src") or image.get("data-src")
        if source:
            screenshot_url = urljoin(url, source)
            chunks.append({
                "id": hashlib.sha1(f"{url}:screenshot:{screenshot_url}".encode("utf-8")).hexdigest(),
                "url": url,
                "title": title,
                "text": f"Screenshot URL for {title}: {screenshot_url}",
                "screenshot_url": screenshot_url,
                "kind": "screenshot",
            })
    return chunks


def run_ingestion(
    sitemap_url: str = DEFAULT_SITEMAP,
    data_dir: str = "data",
    delay: float = 1.0,
    max_pages: int | None = None,
    force: bool = False,
) -> Dict:
    data_path = Path(data_dir)
    state_path = data_path / "ingestion_state.json"
    state = {"completed": [], "failed": [], "discovered": [], "last_url": None} if force else load_state(state_path)
    session = requests.Session()
    sitemap_response = session.get(sitemap_url, timeout=30)
    sitemap_response.raise_for_status()
    urls = discover_urls(sitemap_response.text)
    if max_pages is not None:
        urls = urls[:max_pages]
    state["discovered"] = urls
    completed = set(state.get("completed", []))
    knowledge_base = KnowledgeBase(data_dir)
    for url in urls:
        if url in completed and not force:
            continue
        state["last_url"] = url
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            knowledge_base.add_chunks(extract_chunks(url, response.text))
            state.setdefault("completed", []).append(url)
        except requests.RequestException:
            state.setdefault("failed", []).append(url)
        save_state(state_path, state)
        time.sleep(max(0.0, delay))
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sitemap-url", default=DEFAULT_SITEMAP)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run_ingestion(**vars(args)), indent=2))


if __name__ == "__main__":
    main()
