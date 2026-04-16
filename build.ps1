# Script de build automatizado para la extensión
Write-Host "Construyendo extensión points on point..." -ForegroundColor Green

# Limpiar directorio dist
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "Directorio dist limpiado" -ForegroundColor Yellow
}

# Construir con Vite
Write-Host "Ejecutando npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build exitoso!" -ForegroundColor Green
    
    # Copiar archivos necesarios
    Write-Host "Copiando archivos adicionales..." -ForegroundColor Cyan
    
    Copy-Item -Path "manifest.json" -Destination "dist\manifest.json" -Force
    Copy-Item -Path "src\popup\index.html" -Destination "dist\popup.html" -Force
    Copy-Item -Path "src\content\styles\toast.css" -Destination "dist\toast.css" -Force
    Copy-Item -Path "icons" -Destination "dist\icons" -Recurse -Force
    
    # Actualizar popup.html para apuntar al JS correcto y asegurar que importe el CSS
    $popupContent = Get-Content "dist\popup.html" -Raw
    $popupContent = $popupContent -replace 'src="/src/popup/main.tsx"', 'src="popup.js"'
    
    # Asegurar que el CSS se importe
    if ($popupContent -notmatch 'href="popup.css"') {
        $popupContent = $popupContent -replace '<title>points on point</title>', '<title>points on point</title>`n  <link rel="stylesheet" href="popup.css">'
    }
    
    Set-Content -Path "dist\popup.html" -Value $popupContent
    
    Write-Host "¡Extensión lista para cargar en Chrome!" -ForegroundColor Green
    Write-Host "Carpeta: $((Get-Location).Path)\dist" -ForegroundColor Yellow
} else {
    Write-Host "Error en el build" -ForegroundColor Red
}
