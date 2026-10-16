$ErrorActionPreference = "Stop"
$response = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/health"
if ($response.status -ne "ok" -or $response.service -ne "knowledge-brain") {
  throw "Unexpected health response: $($response | ConvertTo-Json -Compress)"
}
$response | ConvertTo-Json