$ErrorActionPreference = "Stop"
$body = Get-Content (Join-Path $PSScriptRoot "sample-data.json") -Raw
$response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:8000/ingestion/run" -ContentType "application/json" -Body $body
if ($response.StatusCode -ne 202) {
  throw "Expected HTTP 202, received $($response.StatusCode)"
}
$response.Content