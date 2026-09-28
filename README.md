# MS建設管理システム 社内ネットワーク版

## 構成
- 画面本体: GitHub Pages
- 共有データ: 親PC `server.py` / `shared_data`
- 初期接続先: `http://192.168.1.5:8766`

## 親PC
`start_server.bat` を起動したままにします。

## PC1 / PC2
GitHub Pages を開き、初回にブラウザからローカルネットワークへのアクセスを求められたら許可します。

## IP変更時
`network_settings.html` で親PCの接続先を変更します。

## 実データ
`shared_data/` はGitHubへアップロードしません。
