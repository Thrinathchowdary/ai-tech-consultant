$ErrorActionPreference = "Stop"
$body = Get-Content (Join-Path $PSScriptRoot "sample-data.json") -Raw
$response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:8000/escalations" -ContentType "application/json" -Body $body
if ($response.StatusCode -ne 201) {
  throw "Expected HTTP 201, received $($response.StatusCode)"
}
$response.Content