$port = 8000
$path = "c:\Engineering\DEV\WEB\Website"

Write-Host "Starting HTTP server on http://localhost:$port"
Write-Host "Serving files from: $path"
Write-Host "Press Ctrl+C to stop"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

while ($true) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    Write-Host "$($request.HttpMethod) $($request.Url.LocalPath)"

    $localPath = "$path$($request.Url.LocalPath)"
    if ((Test-Path $localPath) -and (Get-Item $localPath).PSIsContainer) {
        $localPath = "$localPath\index.html"
    }

    if (Test-Path $localPath) {
        $bytes = [System.IO.File]::ReadAllBytes($localPath)
        
        # Guess content type
        $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
        $contentType = switch ($ext) {
            ".html" { "text/html" }
            ".css" { "text/css" }
            ".js" { "application/javascript" }
            ".json" { "application/json" }
            ".glb" { "model/gltf-binary" }
            ".png" { "image/png" }
            ".jpg" { "image/jpeg" }
            ".gif" { "image/gif" }
            ".webp" { "image/webp" }
            ".svg" { "image/svg+xml" }
            ".woff" { "font/woff" }
            ".woff2" { "font/woff2" }
            default { "application/octet-stream" }
        }

        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.StatusCode = 200
    } else {
        $response.StatusCode = 404
        $response.StatusDescription = "Not Found"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }

    $response.Close()
}
