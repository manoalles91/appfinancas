# Supabase Keep-Alive Script
# Runs a simple query to prevent the free tier project from pausing due to inactivity.
# Schedule this via Windows Task Scheduler to run weekly.

$supabaseUrl = "https://nwdzrntbmiwaauauwpga.supabase.co"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZHpybnRibWl3YWF1YXV3cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjI2OTksImV4cCI6MjA4ODYzODY5OX0.7Mr3jd_Rz_Cp-ADi54z26B4ESxItsyQ05DIJLEqjfNc"

$headers = @{
    "apikey"        = $anonKey
    "Authorization" = "Bearer $anonKey"
}

try {
    $null = Invoke-RestMethod `
        -Uri "$supabaseUrl/rest/v1/transactions?select=id&limit=1" `
        -Headers $headers `
        -Method GET

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Output "[$timestamp] Supabase keep-alive OK. Project is active."
} catch {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Output "[$timestamp] ERRO: Falha no keep-alive - $($_.Exception.Message)"
}
