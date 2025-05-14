# check_port.ps1
# 指定されたポートがLISTEN状態かチェックし、起動していればエラー終了する
# 戻り値： 0 -> 起動していない, 1 -> 起動している

# 引数としてチェックしたいポート番号を受け取る
[int[]]$PortsToCheck = $args

# ★★★ 出力エンコーディングをシステムのOEMコードページに設定 ★★★
# これにより、バッチファイルと同じ文字コードで出力されるようになる
$PSDefaultParameterValues['*:Write-Host:Encoding'] = [System.Text.Encoding]::GetEncoding([cultureinfo]::CurrentCulture.TextInfo.OEMCodePage)
# ★★★ ここまで追加/修正 ★★★


$IsRunning = $false

foreach ($Port in $PortsToCheck) {
    Write-Host "Checking port $Port..."
    # Get-NetTCPConnection は PowerShell Core (PS 6+) で推奨
    # 旧バージョン (Windows PowerShell 5.1) の場合は netstat を使う
    # Windows PowerShell 5.1 の場合:
    $netstat_output = netstat -aon | Select-String -Pattern ":$Port"
    if ($netstat_output) {
        # 指定ポートを含む行が見つかったら、その中で LISTENING 状態の行を探す
        $listening_output = $netstat_output | Select-String -Pattern "LISTENING"
        if ($listening_output) {
            Write-Host "  Port $Port is LISTENING." -ForegroundColor Yellow
            $IsRunning = $true
            # 一つでも起動していればチェック終了
            break
        } else {
            Write-Host "  Port $Port found, but not in LISTENING state." -ForegroundColor Gray
        }
    } else {
         Write-Host "  Port $Port is not in use." -ForegroundColor Gray
    }
}

if ($IsRunning) {
    # ★★★ 文字化けしないようにメッセージを修正 ★★★
    # ANSI/Shift_JISで表示可能な日本語を使用
    Write-Host "`n======================================================" -ForegroundColor Red
    Write-Host " MCP Server or Agent Server is running." -ForegroundColor Red
    Write-Host " System will Stop This Scripts!" -ForegroundColor Red
    Write-Host "======================================================" -ForegroundColor Red
    # バッチファイルにエラーを伝えるためにエラーコードを返す
    exit 1
} else {
    # ★★★ 文字化けしないようにメッセージを修正 ★★★
    Write-Host "`nPort check completed. Related processes are not running." -ForegroundColor Green
    # バッチファイルに成功を伝えるためにエラーコード0を返す
    exit 0
}