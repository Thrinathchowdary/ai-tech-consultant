"""Hybrid lexical and ChromaDB retrieval with citation-aware answers."""

import hashlib
import json
import math
import os
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List

try:
    import chromadb
except ImportError:  # pragma: no cover - exercised only without optional install
    chromadb = None

_WORDS = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_-]*")


def _tokens(text: str) -> List[str]:
    tokens = []
    for word in _WORDS.findall(text):
        token = word.lower()
        if token.endswith("ies") and len(token) > 4:
            token = f"{token[:-3]}y"
        elif token.endswith("s") and not token.endswith("ss") and len(token) > 3:
            token = token[:-1]
        tokens.append(token)
    return tokens


def _embedding(text: str, dimensions: int = 128) -> List[float]:
    vector = [0.0] * dimensions
    for token in _tokens(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        vector[index] += 1.0 if digest[4] % 2 else -1.0
    magnitude = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / magnitude for value in vector]


class KnowledgeBase:
    def __init__(self, data_dir: str = "data") -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.chunks_path = self.data_dir / "chunks.jsonl"
        self._chunks: List[Dict[str, Any]] = []
        self._collection = None
        if chromadb is not None:
            try:
                client = chromadb.PersistentClient(path=str(self.data_dir / "chroma"))
                self._collection = client.get_or_create_collection(
                    name="support_chunks", metadata={"hnsw:space": "cosine"}
                )
            except Exception:
                self._collection = None
        self.reload()

    def reload(self) -> None:
        self._chunks = []
        if self.chunks_path.exists():
            with self.chunks_path.open("r", encoding="utf-8") as stream:
                for line in stream:
                    if line.strip():
                        self._chunks.append(json.loads(line))

    def add_chunks(self, chunks: Iterable[Dict[str, Any]]) -> int:
        new_chunks = list(chunks)
        if not new_chunks:
            return 0
        existing_ids = {chunk["id"] for chunk in self._chunks}
        unique = [chunk for chunk in new_chunks if chunk["id"] not in existing_ids]
        if not unique:
            return 0
        with self.chunks_path.open("a", encoding="utf-8") as stream:
            for chunk in unique:
                stream.write(json.dumps(chunk, ensure_ascii=True) + "\n")
        self._chunks.extend(unique)
        self._upsert_chroma(unique)
        return len(unique)

    def _upsert_chroma(self, chunks: List[Dict[str, Any]]) -> None:
        if self._collection is None:
            return
        try:
            self._collection.upsert(
                ids=[chunk["id"] for chunk in chunks],
                documents=[chunk["text"] for chunk in chunks],
                metadatas=[{"url": chunk["url"], "title": chunk.get("title", "")} for chunk in chunks],
                embeddings=[_embedding(chunk["text"]) for chunk in chunks],
            )
        except Exception:
            self._collection = None

    def search(self, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self._chunks:
            return []
        query_tokens = set(_tokens(question))
        lexical: Dict[str, float] = {}
        for chunk in self._chunks:
            chunk_tokens = set(_tokens(chunk["text"]))
            overlap = len(query_tokens & chunk_tokens)
            lexical[chunk["id"]] = overlap / max(len(query_tokens), 1)

        semantic: Dict[str, float] = {}
        if self._collection is not None:
            try:
                result = self._collection.query(
                    query_embeddings=[_embedding(question)], n_results=min(top_k * 3, len(self._chunks))
                )
                ids = result.get("ids", [[]])[0]
                distances = result.get("distances", [[]])[0]
                for item_id, distance in zip(ids, distances):
                    semantic[item_id] = max(0.0, 1.0 - float(distance))
            except Exception:
                semantic = {}

        scored = []
        has_lexical_match = any(score > 0 for score in lexical.values())
        for chunk in self._chunks:
            if has_lexical_match:
                score = lexical[chunk["id"]]
            else:
                score = semantic.get(chunk["id"], 0.0)
            scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [dict(chunk, score=round(score, 4)) for score, chunk in scored[:top_k] if score > 0]

    def answer(self, question: str, top_k: int = 5) -> Dict[str, Any]:
        results = self.search(question, top_k)
        if not results:
            return {"answer": "I could not find supporting documentation for that question.", "sources": [], "confidence": 0.0, "needs_human": True}
        answer = " ".join(result["text"] for result in results[:3])
        confidence = min(0.98, max(0.2, 0.55 + results[0]["score"] * 0.4 + min(len(results), 3) * 0.05))
        return {
            "answer": answer,
            "sources": list(dict.fromkeys(result["url"] for result in results)),
            "confidence": round(confidence, 2),
            "needs_human": confidence < 0.45,
        }
