$ErrorActionPreference = "Stop"
$response = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/ingestion/status"
if ($null -eq $response.running -or $null -eq $response.message) {
  throw "Unexpected ingestion status response: $($response | ConvertTo-Json -Compress)"
}
$response | ConvertTo-Json