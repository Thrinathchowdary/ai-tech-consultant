$ErrorActionPreference = "Stop"
$body = Get-Content (Join-Path $PSScriptRoot "sample-data.json") -Raw
$response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/query" -ContentType "application/json" -Body $body
if ([string]::IsNullOrWhiteSpace($response.answer)) {
  throw "Query response did not contain an answer"
}
$response | ConvertTo-Json