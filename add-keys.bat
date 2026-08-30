@echo off
set ETH_KEY=%~1
set TRON_KEY=%~2
set CA_KEY=%~3

if "%ETH_KEY%"=="" (
    echo Usage: add-keys.bat ^<ETH_KEY^> ^<TRON_KEY^> ^<CHAINABUSE_KEY^>
    exit /b 1
)

echo Updating Etherscan API Key...
sqlite3 apps\api\chainsentinel.sqlite "UPDATE blockchain_api_configs SET apiKey='%ETH_KEY%', status='live' WHERE chain='ETHEREUM';"

echo Updating TronGrid API Key...
sqlite3 apps\api\chainsentinel.sqlite "UPDATE blockchain_api_configs SET apiKey='%TRON_KEY%', status='live' WHERE chain='TRON';"

echo API Keys updated successfully in the database!
