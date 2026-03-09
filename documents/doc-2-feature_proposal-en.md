# Feature Proposal

## Feature List (Must / Should / Could)

### Must
1. **Whisperベースのアップロード式音声認識**  
   - Purpose: 会議後に録音ファイルをアップロードし、高い精度で文字起こしを行う  
   - Target Users: 会議議事録担当者、プロジェクトメンバー  
   - Evidence:  
     - 「音声認識の方法はウィスパーを使った」 (Input #2)  
     - 要件「Whisperベースのアップロード式音声認識」 (Structured Items [requirement] Input #5)

2. **リアルタイムAPIによる音声認識とライブ字幕表示**  
   - Purpose: 会議中にリアルタイムで文字起こしおよび字幕表示し、議論を即時に把握できるようにする  
   - Target Users: 会議参加者（特にリモート参加者）、ファシリテーター  
   - Evidence:  
     - 「リアルタイムAPIだと…リアルタイムに把握できる」 (Input #2)  
     - 決定事項「Transcription Method Selection」 (Input #5)

3. **マイク本体へのローカル録音バックアップ機能**  
   - Purpose: 音声取得失敗時に備え、マイク内部に録音データを保存してデータ喪失リスクを低減する  
   - Target Users: IT管理者、議事録担当者  
   - Evidence:  
     - 要件「Local Backup Recording」 (Structured Items [requirement] Input #5)  
     - リスク「Voice Capture Failure」 (Structured Items [risk] Input #5)

4. **会議サマリー生成機能（要点・決定事項・論点・次アクション抽出）**  
   - Purpose: 音声認識結果から自動的にサマリーを作成し、決定事項やToDoを構造化して提示する  
   - Target Users: プロジェクトメンバー全員、マネージャー  
   - Evidence:  
     - 要件「音声入力による会議サマリー作成機能」 (Structured Items [requirement] Input #4)  
     - Feature Candidates「音声から議事録/会議サマリー生成」 (Project Summary)

5. **会議サマリーの統合 (RAG導入)**  
   - Purpose: 複数回にわたる会議のサマリーを一元的に統合し、文脈を補強しながら要点を抽出できるようにする  
   - Target Users: プロジェクトリーダー、ナレッジマネジメント担当者  
   - Evidence:  
     - 要件「会議サマリーの統合」 (Structured Items [requirement] Input #7)  
     - 要件「RAGの導入」 (Structured Items [requirement] Input #7)

6. **プロジェクト発足時のキックオフ資料・機能提案書自動生成**  
   - Purpose: プロジェクト立ち上げ時のドキュメント作成負荷を低減し、標準化された品質の資料を自動生成する  
   - Target Users: PMO、プロジェクトマネージャー  
   - Evidence:  
     - 要件「プロジェクト発足時の資料作成機能」 (Structured Items [requirement] Input #4)  

### Should
1. **サマリーの編集・追記・再生成機能**  
   - Purpose: 自動生成したサマリーに対し、プロンプト指定で補足や修正を加えられる  
   - Target Users: 議事録担当者、上長レビュー担当者  
   - Evidence: Feature Candidates「サマリーの編集・再生成」 (Project Summary)

2. **決定事項・ToDoの抽出と項目化 (担当/期限手入力補助)**  
   - Purpose: 抽出したアクションアイテムに対して担当者や期限を入力しやすいUIを提供する  
   - Target Users: プロジェクトメンバー、PMO  
   - Evidence: Feature Candidates「決定事項・ToDoの抽出と項目化」 (Project Summary)

3. **会議サマリーの共有機能 (URL共有、PDF/Docx/Markdownエクスポート)**  
   - Purpose: 生成したサマリーを多様な形式で外部共有・配布できるようにする  
   - Target Users: 会議参加者全員、外部ステークホルダー  
   - Evidence: Feature Candidates「会議サマリーの共有」 (Project Summary)

### Could
1. **テンプレート管理機能 (社内標準フォーマット登録・反映)**  
   - Purpose: 各部門のフォーマット差異を吸収し、標準化されたテンプレートを社内で管理する  
   - Target Users: PMO、ドキュメント管理者  
   - Evidence: Project Summary「テンプレートや生成物の期待品質が部門ごとに異なる」(risks)

2. **履歴管理機能 (版管理、差分表示)**  
   - Pu