export type Lang = 'zh-TW' | 'en' | 'ko' | 'th' | 'vi' | 'fr' | 'es' | 'de' | 'id' | 'zh-CN';

export const SUPPORTED_LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
];

type Translations = Record<string, string>;

const zh_TW: Translations = {
  // Header
  'app.name': 'GoSavor',
  'nav.login': '登入',
  'nav.logout': '登出',
  'nav.expenses': '記帳簿',
  'nav.history': '點餐紀錄',
  'nav.settings': '設定',

  // Scan modes
  'mode.menu': '菜單翻譯',
  'mode.receipt': '收據翻譯',
  'mode.general': '萬用翻譯',
  'mode.menu.desc': 'AI 翻譯並生成點餐介面',
  'mode.receipt.desc': '掃描收據，翻譯明細',
  'mode.general.desc': '籤詩、告示、標誌翻譯',

  // Camera
  'camera.shoot': '拍照',
  'camera.upload': '上傳照片',
  'camera.analyze': '分析中...',

  // Results
  'result.dishes': '道菜',
  'recommended': '推薦',
  'result.items': '項',
  'result.newScan': '重新掃描',
  'result.receipt': '收據分析',
  'result.translation': '翻譯解析',

  // Markers
  'marker.show': '標記',
  'marker.hidden': '標記已隱藏',
  'marker.expand': '展開',
  'marker.collapse': '收合',

  // Checkout
  'checkout.title': '結帳確認',
  'checkout.button': '結帳',
  'checkout.review': '確認清單',
  'checkout.staff': '店員模式',
  'checkout.split': '分帳',
  'checkout.subtotal': '小計',
  'checkout.tax': '稅金',
  'checkout.serviceFee': '服務費',
  'checkout.total': '合計',
  'checkout.confirm': '確認點餐',
  'checkout.success': '點餐成功！店員秒懂',
  'checkout.speak': '播放日語點餐',
  'checkout.speaking': '正在點餐中...',
  'checkout.back': '返回修改',
  'checkout.whoPaid': '誰先付款？',
  'checkout.persons': '人數',
  'checkout.perPerson': '每人金額',
  'checkout.confirmSplit': '確認分帳',

  // Voice
  'voice.label': '語音',
  'voice.female': '👩 女聲',
  'voice.male': '👨 男聲',
  'voice.from': '來自',

  // Settings
  'settings.title': '應用設定',
  'settings.apiKey': 'Gemini API Key',
  'settings.saveKey': '儲存 Key',
  'settings.saved': '已儲存',
  'settings.getKey': '免費取得 API Key',
  'settings.price': '價格估算設定',
  'settings.taxRate': '稅率 (%)',
  'settings.serviceFee': '服務費 (%)',
  'settings.taxHint': '日本多數餐廳已含稅（税込），通常設 0% 即可。若菜單標示「税抜」則設 10%。',
  'settings.language': '翻譯語言',
  'settings.currency': '本國貨幣',
  'settings.currencyHint': '用於匯率換算，顯示餐點約等於多少本國貨幣。',
  'settings.rateSource': '來源：Currency API',
  'settings.rateUpdated': '更新於',
  'settings.allergens': '過敏原設定',
  'settings.allergensHint': '選擇你的過敏原，AI 會自動標記含有這些成分的菜品。',
  'settings.reset': '重設',

  // History
  'history.title': '點餐紀錄',
  'history.empty': '還沒有點餐紀錄',
  'history.emptyHint': '掃描菜單後點餐即可留下紀錄',
  'history.navigate': '導航',
  'history.recent': '最近掃描',
  'history.all': '全部',
  'history.menuType': '菜單',
  'history.receiptType': '收據',
  'history.translationType': '翻譯',

  // Receipt
  'receipt.search': '搜尋店家',
  'receipt.qty': '總數量',
  'receipt.taxFree': '免稅',
  'receipt.taxNormal': '一般',
  'receipt.total': '總計',
  'receipt.addExpense': '加入記帳簿',
  'receipt.added': '已加入記帳簿',
  'receipt.payer': '付款人（選填）',

  // Expenses
  'expenses.title': '記帳簿',
  'expenses.total': '總消費',
  'expenses.empty': '還沒有記帳紀錄',
  'expenses.emptyHint': '掃描收據後加入記帳簿即可',

  // Categories
  'cat.shopping': '購物',
  'cat.food': '餐飲',
  'cat.transport': '交通',
  'cat.hotel': '住宿',
  'cat.other': '其他',

  // General
  'general.aiExplain': 'AI 解讀',

  // Allergens
  'allergen.shrimp': '蝦 (えび)',
  'allergen.crab': '蟹 (かに)',
  'allergen.peanut': '花生 (ピーナッツ)',
  'allergen.egg': '蛋 (卵)',
  'allergen.milk': '牛奶 (乳)',
  'allergen.wheat': '小麥 (小麦)',
  'allergen.soba': '蕎麥 (そば)',
  'allergen.fish': '魚 (魚)',
  'allergen.soy': '大豆 (大豆)',
  'allergen.sesame': '芝麻 (ごま)',
  'allergen.shellfish': '貝類 (貝類)',
  'allergen.beef': '牛肉 (牛肉)',
  'allergen.pork': '豬肉 (豚肉)',

  // Errors
  'error.noKey': '請先設定 Gemini API Key，或登入使用租用版。',
  'error.failed': '分析失敗，請確認 API Key 是否正確或重試。',
  'error.goSettings': '前往設定',
};

const en: Translations = {
  'app.name': 'GoSavor',
  'nav.login': 'Login', 'nav.logout': 'Logout', 'nav.expenses': 'Expenses', 'nav.history': 'Orders', 'nav.settings': 'Settings',
  'mode.menu': 'Menu', 'mode.receipt': 'Receipt', 'mode.general': 'Translate',
  'mode.menu.desc': 'AI translates menu & helps you order', 'mode.receipt.desc': 'Scan receipt, translate items', 'mode.general.desc': 'Signs, fortune slips, notices',
  'camera.shoot': 'Camera', 'camera.upload': 'Upload', 'camera.analyze': 'Analyzing...',
  'result.dishes': 'dishes', 'recommended': 'Recommended', 'result.items': 'items', 'result.newScan': 'New Scan', 'result.receipt': 'Receipt', 'result.translation': 'Translation',
  'marker.show': 'Markers', 'marker.hidden': 'Markers hidden', 'marker.expand': 'Expand', 'marker.collapse': 'Collapse',
  'checkout.title': 'Checkout', 'checkout.button': 'Checkout', 'checkout.review': 'Review', 'checkout.staff': 'Staff Mode', 'checkout.split': 'Split',
  'checkout.subtotal': 'Subtotal', 'checkout.tax': 'Tax', 'checkout.serviceFee': 'Service Fee', 'checkout.total': 'Total',
  'checkout.confirm': 'Confirm Order', 'checkout.success': 'Order placed!', 'checkout.speak': 'Speak Order (Japanese)',
  'checkout.speaking': 'Speaking...', 'checkout.back': 'Back', 'checkout.whoPaid': 'Who paid first?',
  'checkout.persons': 'Persons', 'checkout.perPerson': 'Per Person', 'checkout.confirmSplit': 'Confirm Split',
  'voice.label': 'Voice', 'voice.female': '👩 Female', 'voice.male': '👨 Male', 'voice.from': 'From',
  'settings.title': 'Settings', 'settings.apiKey': 'Gemini API Key', 'settings.saveKey': 'Save Key', 'settings.saved': 'Saved',
  'settings.getKey': 'Get a free API Key', 'settings.price': 'Price Estimation', 'settings.taxRate': 'Tax Rate (%)', 'settings.serviceFee': 'Service Fee (%)',
  'settings.taxHint': 'Most Japanese restaurants include tax (税込). Set 0% unless menu says 税抜.',
  'settings.language': 'Language', 'settings.currency': 'Home Currency', 'settings.currencyHint': 'For exchange rate conversion.',
  'general.aiExplain': 'AI Interpretation',
  'settings.rateSource': 'Source: Currency API', 'settings.rateUpdated': 'Updated',
  'settings.allergens': 'Allergens', 'settings.allergensHint': 'AI will flag menu items containing these.', 'settings.reset': 'Reset',
  'history.title': 'Order History', 'history.empty': 'No orders yet', 'history.emptyHint': 'Scan a menu and place an order',
  'history.navigate': 'Navigate', 'history.recent': 'Recent Scans', 'history.all': 'All',
  'history.menuType': 'Menu', 'history.receiptType': 'Receipt', 'history.translationType': 'Translation',
  'receipt.search': 'Find Store', 'receipt.qty': 'Total Qty', 'receipt.taxFree': 'Tax Free', 'receipt.taxNormal': 'Standard',
  'receipt.total': 'Total', 'receipt.addExpense': 'Add to Expenses', 'receipt.added': 'Added to Expenses', 'receipt.payer': 'Payer (optional)',
  'expenses.title': 'Expense Book', 'expenses.total': 'Total Spent', 'expenses.empty': 'No expenses yet', 'expenses.emptyHint': 'Scan a receipt to add',
  'cat.shopping': 'Shopping', 'cat.food': 'Food', 'cat.transport': 'Transport', 'cat.hotel': 'Hotel', 'cat.other': 'Other',
  'allergen.shrimp': 'Shrimp (えび)', 'allergen.crab': 'Crab (かに)', 'allergen.peanut': 'Peanut (ピーナッツ)',
  'allergen.egg': 'Egg (卵)', 'allergen.milk': 'Milk (乳)', 'allergen.wheat': 'Wheat (小麦)',
  'allergen.soba': 'Buckwheat (そば)', 'allergen.fish': 'Fish (魚)', 'allergen.soy': 'Soy (大豆)',
  'allergen.sesame': 'Sesame (ごま)', 'allergen.shellfish': 'Shellfish (貝類)', 'allergen.beef': 'Beef (牛肉)', 'allergen.pork': 'Pork (豚肉)',
  'error.noKey': 'Please set your Gemini API Key in Settings.', 'error.failed': 'Analysis failed. Check your API Key.', 'error.goSettings': 'Go to Settings',
};

const fr: Translations = {
  ...en,
  'nav.login': 'Connexion', 'nav.logout': 'Déconnexion', 'nav.expenses': 'Dépenses', 'nav.history': 'Commandes', 'nav.settings': 'Paramètres',
  'mode.menu': 'Menu', 'mode.receipt': 'Reçu', 'mode.general': 'Traduire',
  'mode.menu.desc': 'L\'IA traduit le menu et vous aide à commander', 'mode.receipt.desc': 'Scanner le reçu, traduire', 'mode.general.desc': 'Panneaux, omikuji, avis',
  'camera.shoot': 'Photo', 'camera.upload': 'Télécharger', 'camera.analyze': 'Analyse...',
  'result.dishes': 'plats', 'recommended': 'Recommandé', 'result.items': 'articles', 'result.newScan': 'Nouveau Scan', 'result.receipt': 'Reçu', 'result.translation': 'Traduction',
  'marker.show': 'Repères', 'marker.hidden': 'Repères masqués', 'marker.expand': 'Agrandir', 'marker.collapse': 'Réduire',
  'checkout.title': 'Caisse', 'checkout.button': 'Commander', 'checkout.review': 'Vérifier', 'checkout.staff': 'Mode Staff', 'checkout.split': 'Partager',
  'checkout.subtotal': 'Sous-total', 'checkout.tax': 'Taxe', 'checkout.serviceFee': 'Service', 'checkout.total': 'Total',
  'checkout.confirm': 'Confirmer', 'checkout.success': 'Commande passée !', 'checkout.speak': 'Commander en japonais',
  'checkout.speaking': 'En cours...', 'checkout.back': 'Retour', 'checkout.whoPaid': 'Qui a payé ?',
  'checkout.persons': 'Personnes', 'checkout.perPerson': 'Par personne', 'checkout.confirmSplit': 'Confirmer',
  'voice.label': 'Voix', 'voice.female': '👩 Femme', 'voice.male': '👨 Homme', 'voice.from': 'Origine',
  'settings.title': 'Paramètres', 'settings.apiKey': 'Clé API Gemini', 'settings.saveKey': 'Enregistrer', 'settings.saved': 'Enregistré',
  'settings.getKey': 'Obtenir une clé gratuite',
  'settings.language': 'Langue', 'settings.currency': 'Devise', 'settings.currencyHint': 'Pour la conversion des taux de change.',
  'settings.allergens': 'Allergènes', 'settings.allergensHint': 'L\'IA signalera les plats contenant ces ingrédients.', 'settings.reset': 'Réinitialiser',
  'history.title': 'Historique', 'history.empty': 'Pas encore de commande', 'history.emptyHint': 'Scannez un menu pour commencer',
  'history.navigate': 'Naviguer', 'history.recent': 'Scans récents', 'history.all': 'Tout',
  'history.menuType': 'Menu', 'history.receiptType': 'Reçu', 'history.translationType': 'Traduction',
  'receipt.search': 'Chercher magasin', 'receipt.qty': 'Quantité', 'receipt.taxFree': 'Détaxé', 'receipt.taxNormal': 'Standard',
  'receipt.total': 'Total', 'receipt.addExpense': 'Ajouter aux dépenses', 'receipt.added': 'Ajouté', 'receipt.payer': 'Payeur (optionnel)',
  'expenses.title': 'Dépenses', 'expenses.total': 'Total dépensé', 'expenses.empty': 'Pas encore de dépenses', 'expenses.emptyHint': 'Scannez un reçu',
  'cat.shopping': 'Shopping', 'cat.food': 'Restaurant', 'cat.transport': 'Transport', 'cat.hotel': 'Hôtel', 'cat.other': 'Autre',
  'error.noKey': 'Veuillez configurer votre clé API Gemini.', 'error.failed': 'Échec de l\'analyse.', 'error.goSettings': 'Paramètres',
  'allergen.shrimp': 'Crevette (えび)', 'allergen.crab': 'Crabe (かに)', 'allergen.peanut': 'Cacahuète (ピーナッツ)',
  'allergen.egg': 'Œuf (卵)', 'allergen.milk': 'Lait (乳)', 'allergen.wheat': 'Blé (小麦)',
  'allergen.soba': 'Sarrasin (そば)', 'allergen.fish': 'Poisson (魚)', 'allergen.soy': 'Soja (大豆)',
  'allergen.sesame': 'Sésame (ごま)', 'allergen.shellfish': 'Coquillage (貝類)', 'allergen.beef': 'Bœuf (牛肉)', 'allergen.pork': 'Porc (豚肉)',
};

const es: Translations = {
  ...en,
  'nav.login': 'Iniciar sesión', 'nav.logout': 'Cerrar sesión', 'nav.expenses': 'Gastos', 'nav.history': 'Pedidos', 'nav.settings': 'Ajustes',
  'mode.menu': 'Menú', 'mode.receipt': 'Recibo', 'mode.general': 'Traducir',
  'mode.menu.desc': 'IA traduce el menú y te ayuda a pedir', 'mode.receipt.desc': 'Escanear recibo y traducir', 'mode.general.desc': 'Carteles, omikuji, avisos',
  'camera.shoot': 'Foto', 'camera.upload': 'Subir', 'camera.analyze': 'Analizando...',
  'result.dishes': 'platos', 'recommended': 'Recomendado', 'result.items': 'artículos', 'result.newScan': 'Nuevo Scan', 'result.receipt': 'Recibo', 'result.translation': 'Traducción',
  'checkout.title': 'Pagar', 'checkout.button': 'Pagar', 'checkout.total': 'Total', 'checkout.confirm': 'Confirmar',
  'checkout.success': '¡Pedido realizado!', 'checkout.speak': 'Pedir en japonés',
  'settings.title': 'Ajustes', 'settings.language': 'Idioma', 'settings.currency': 'Moneda',
  'settings.allergens': 'Alérgenos', 'settings.allergensHint': 'La IA marcará los platos que contengan estos ingredientes.',
  'settings.reset': 'Restablecer',
  'history.title': 'Historial', 'history.recent': 'Recientes', 'history.all': 'Todo',
  'error.noKey': 'Configure su clave API de Gemini.', 'error.failed': 'Error en el análisis.',
  'cat.shopping': 'Compras', 'cat.food': 'Comida', 'cat.transport': 'Transporte', 'cat.hotel': 'Hotel', 'cat.other': 'Otro',
  'allergen.shrimp': 'Camarón (えび)', 'allergen.crab': 'Cangrejo (かに)', 'allergen.peanut': 'Maní (ピーナッツ)',
  'allergen.egg': 'Huevo (卵)', 'allergen.milk': 'Leche (乳)', 'allergen.wheat': 'Trigo (小麦)',
  'allergen.soba': 'Alforfón (そば)', 'allergen.fish': 'Pescado (魚)', 'allergen.soy': 'Soja (大豆)',
  'allergen.sesame': 'Sésamo (ごま)', 'allergen.shellfish': 'Marisco (貝類)', 'allergen.beef': 'Res (牛肉)', 'allergen.pork': 'Cerdo (豚肉)',
};

const de: Translations = {
  ...en,
  'nav.login': 'Anmelden', 'nav.logout': 'Abmelden', 'nav.expenses': 'Ausgaben', 'nav.history': 'Bestellungen', 'nav.settings': 'Einstellungen',
  'mode.menu': 'Speisekarte', 'mode.receipt': 'Quittung', 'mode.general': 'Übersetzen',
  'mode.menu.desc': 'KI übersetzt die Speisekarte', 'mode.receipt.desc': 'Quittung scannen', 'mode.general.desc': 'Schilder, Omikuji, Hinweise',
  'camera.shoot': 'Foto', 'camera.upload': 'Hochladen', 'camera.analyze': 'Analysiert...',
  'result.dishes': 'Gerichte', 'recommended': 'Empfohlen', 'result.items': 'Artikel', 'result.newScan': 'Neuer Scan',
  'checkout.title': 'Kasse', 'checkout.button': 'Bestellen', 'checkout.total': 'Gesamt', 'checkout.confirm': 'Bestätigen',
  'settings.title': 'Einstellungen', 'settings.language': 'Sprache', 'settings.currency': 'Währung',
  'settings.allergens': 'Allergene', 'settings.allergensHint': 'KI markiert Gerichte mit diesen Zutaten.',
  'settings.reset': 'Zurücksetzen',
  'history.title': 'Verlauf', 'history.recent': 'Neueste', 'history.all': 'Alle',
  'cat.shopping': 'Einkaufen', 'cat.food': 'Essen', 'cat.transport': 'Transport', 'cat.hotel': 'Hotel', 'cat.other': 'Sonstige',
  'allergen.shrimp': 'Garnele (えび)', 'allergen.crab': 'Krabbe (かに)', 'allergen.peanut': 'Erdnuss (ピーナッツ)',
  'allergen.egg': 'Ei (卵)', 'allergen.milk': 'Milch (乳)', 'allergen.wheat': 'Weizen (小麦)',
  'allergen.soba': 'Buchweizen (そば)', 'allergen.fish': 'Fisch (魚)', 'allergen.soy': 'Soja (大豆)',
  'allergen.sesame': 'Sesam (ごま)', 'allergen.shellfish': 'Muschel (貝類)', 'allergen.beef': 'Rind (牛肉)', 'allergen.pork': 'Schwein (豚肉)',
};

const ko: Translations = {
  ...en,
  'nav.login': '로그인', 'nav.logout': '로그아웃', 'nav.expenses': '가계부', 'nav.history': '주문기록', 'nav.settings': '설정',
  'mode.menu': '메뉴 번역', 'mode.receipt': '영수증 번역', 'mode.general': '범용 번역',
  'mode.menu.desc': 'AI가 메뉴를 번역하고 주문을 도와줍니다', 'mode.receipt.desc': '영수증 스캔 및 번역', 'mode.general.desc': '간판, 오미쿠지, 안내문',
  'camera.shoot': '촬영', 'camera.upload': '업로드', 'camera.analyze': '분석 중...',
  'result.dishes': '요리', 'recommended': '추천', 'result.items': '개', 'result.newScan': '새 스캔',
  'result.receipt': '영수증 분석', 'result.translation': '번역 결과',
  'checkout.title': '결제', 'checkout.button': '결제', 'checkout.total': '합계', 'checkout.confirm': '주문 확인',
  'checkout.review': '확인', 'checkout.staff': '직원 모드', 'checkout.split': '나눠 내기',
  'checkout.subtotal': '소계', 'checkout.tax': '세금', 'checkout.serviceFee': '서비스료',
  'checkout.speak': '일본어로 주문', 'checkout.speaking': '주문 중...', 'checkout.back': '돌아가기',
  'checkout.success': '주문 완료!', 'checkout.whoPaid': '누가 먼저 냈나요?',
  'checkout.persons': '인원', 'checkout.perPerson': '1인당', 'checkout.confirmSplit': '확인',
  'voice.label': '음성', 'voice.female': '👩 여성', 'voice.male': '👨 남성', 'voice.from': '출신',
  'settings.title': '설정', 'settings.language': '언어', 'settings.currency': '통화',
  'settings.apiKey': 'Gemini API Key', 'settings.saveKey': '저장', 'settings.saved': '저장됨',
  'settings.getKey': '무료 API Key 받기', 'settings.currencyHint': '환율 변환에 사용됩니다.',
  'settings.allergens': '알레르기 설정', 'settings.allergensHint': 'AI가 이 성분이 포함된 메뉴를 표시합니다.',
  'settings.reset': '초기화',
  'marker.show': '마커', 'marker.hidden': '마커 숨김', 'marker.expand': '확대', 'marker.collapse': '축소',
  'history.title': '주문 기록', 'history.recent': '최근 스캔', 'history.all': '전체',
  'history.empty': '주문 기록이 없습니다', 'history.emptyHint': '메뉴를 스캔하고 주문하세요',
  'history.navigate': '길찾기', 'history.menuType': '메뉴', 'history.receiptType': '영수증', 'history.translationType': '번역',
  'receipt.search': '매장 검색', 'receipt.qty': '총 수량', 'receipt.taxFree': '면세', 'receipt.taxNormal': '일반',
  'receipt.total': '합계', 'receipt.addExpense': '가계부에 추가', 'receipt.added': '추가됨', 'receipt.payer': '결제자 (선택)',
  'expenses.title': '가계부', 'expenses.total': '총 지출', 'expenses.empty': '지출 기록 없음', 'expenses.emptyHint': '영수증을 스캔하세요',
  'cat.shopping': '쇼핑', 'cat.food': '음식', 'cat.transport': '교통', 'cat.hotel': '숙소', 'cat.other': '기타',
  'error.noKey': 'Gemini API Key를 설정해주세요.', 'error.failed': '분석 실패. API Key를 확인하세요.', 'error.goSettings': '설정으로',
  'allergen.shrimp': '새우 (えび)', 'allergen.crab': '게 (かに)', 'allergen.peanut': '땅콩 (ピーナッツ)',
  'allergen.egg': '달걀 (卵)', 'allergen.milk': '우유 (乳)', 'allergen.wheat': '밀 (小麦)',
  'allergen.soba': '메밀 (そば)', 'allergen.fish': '생선 (魚)', 'allergen.soy': '대두 (大豆)',
  'allergen.sesame': '참깨 (ごま)', 'allergen.shellfish': '조개류 (貝類)', 'allergen.beef': '소고기 (牛肉)', 'allergen.pork': '돼지고기 (豚肉)',
};

const th: Translations = {
  ...en,
  'mode.menu': 'แปลเมนู', 'mode.receipt': 'แปลใบเสร็จ', 'mode.general': 'แปลทั่วไป',
  'mode.menu.desc': 'AI แปลเมนูและช่วยสั่งอาหาร', 'mode.receipt.desc': 'สแกนใบเสร็จ แปลรายการ', 'mode.general.desc': 'ป้าย, โอมิคุจิ, ประกาศ',
  'camera.shoot': 'ถ่ายรูป', 'camera.upload': 'อัพโหลด', 'camera.analyze': 'กำลังวิเคราะห์...',
  'result.dishes': 'เมนู', 'result.newScan': 'สแกนใหม่',
  'checkout.title': 'ชำระเงิน', 'checkout.total': 'รวม', 'checkout.confirm': 'ยืนยัน', 'checkout.speak': 'สั่งภาษาญี่ปุ่น',
  'settings.title': 'ตั้งค่า', 'settings.language': 'ภาษา', 'settings.currency': 'สกุลเงิน',
  'settings.allergens': 'การแพ้อาหาร', 'settings.allergensHint': 'AI จะแจ้งเตือนเมนูที่มีสารก่อภูมิแพ้',
  'settings.reset': 'รีเซ็ต',
  'history.title': 'ประวัติ', 'history.recent': 'ล่าสุด',
  'allergen.shrimp': 'กุ้ง (えび)', 'allergen.crab': 'ปู (かに)', 'allergen.peanut': 'ถั่วลิสง (ピーナッツ)',
  'allergen.egg': 'ไข่ (卵)', 'allergen.milk': 'นม (乳)', 'allergen.wheat': 'ข้าวสาลี (小麦)',
  'allergen.soba': 'โซบะ (そば)', 'allergen.fish': 'ปลา (魚)', 'allergen.soy': 'ถั่วเหลือง (大豆)',
  'allergen.sesame': 'งา (ごま)', 'allergen.shellfish': 'หอย (貝類)', 'allergen.beef': 'เนื้อวัว (牛肉)', 'allergen.pork': 'หมู (豚肉)',
};

const vi: Translations = {
  ...en,
  'mode.menu': 'Dịch thực đơn', 'mode.receipt': 'Dịch hóa đơn', 'mode.general': 'Dịch chung',
  'mode.menu.desc': 'AI dịch thực đơn và hỗ trợ gọi món', 'mode.receipt.desc': 'Quét hóa đơn, dịch chi tiết', 'mode.general.desc': 'Biển báo, omikuji, thông báo',
  'camera.shoot': 'Chụp ảnh', 'camera.upload': 'Tải lên', 'camera.analyze': 'Đang phân tích...',
  'result.dishes': 'món', 'result.newScan': 'Quét mới',
  'checkout.title': 'Thanh toán', 'checkout.total': 'Tổng', 'checkout.confirm': 'Xác nhận',
  'settings.title': 'Cài đặt', 'settings.language': 'Ngôn ngữ', 'settings.currency': 'Tiền tệ',
  'settings.allergens': 'Dị ứng', 'settings.allergensHint': 'AI sẽ cảnh báo các món có chất gây dị ứng.',
  'settings.reset': 'Đặt lại',
  'history.title': 'Lịch sử', 'history.recent': 'Gần đây',
  'allergen.shrimp': 'Tôm (えび)', 'allergen.crab': 'Cua (かに)', 'allergen.peanut': 'Đậu phộng (ピーナッツ)',
  'allergen.egg': 'Trứng (卵)', 'allergen.milk': 'Sữa (乳)', 'allergen.wheat': 'Lúa mì (小麦)',
  'allergen.soba': 'Kiều mạch (そば)', 'allergen.fish': 'Cá (魚)', 'allergen.soy': 'Đậu nành (大豆)',
  'allergen.sesame': 'Mè (ごま)', 'allergen.shellfish': 'Sò (貝類)', 'allergen.beef': 'Thịt bò (牛肉)', 'allergen.pork': 'Thịt heo (豚肉)',
};

const id_ID: Translations = {
  ...en,
  'mode.menu': 'Terjemah Menu', 'mode.receipt': 'Terjemah Struk', 'mode.general': 'Terjemah Umum',
  'mode.menu.desc': 'AI menerjemahkan menu & membantu pesan', 'mode.receipt.desc': 'Scan struk, terjemahkan', 'mode.general.desc': 'Papan nama, omikuji, pengumuman',
  'camera.shoot': 'Kamera', 'camera.upload': 'Unggah', 'camera.analyze': 'Menganalisis...',
  'result.dishes': 'menu', 'result.newScan': 'Scan Baru',
  'checkout.title': 'Pembayaran', 'checkout.total': 'Total', 'checkout.confirm': 'Konfirmasi',
  'settings.title': 'Pengaturan', 'settings.language': 'Bahasa', 'settings.currency': 'Mata Uang',
  'settings.allergens': 'Alergi', 'settings.allergensHint': 'AI akan menandai menu yang mengandung alergen.',
  'settings.reset': 'Reset',
  'history.title': 'Riwayat', 'history.recent': 'Terbaru',
  'allergen.shrimp': 'Udang (えび)', 'allergen.crab': 'Kepiting (かに)', 'allergen.peanut': 'Kacang (ピーナッツ)',
  'allergen.egg': 'Telur (卵)', 'allergen.milk': 'Susu (乳)', 'allergen.wheat': 'Gandum (小麦)',
  'allergen.soba': 'Soba (そば)', 'allergen.fish': 'Ikan (魚)', 'allergen.soy': 'Kedelai (大豆)',
  'allergen.sesame': 'Wijen (ごま)', 'allergen.shellfish': 'Kerang (貝類)', 'allergen.beef': 'Sapi (牛肉)', 'allergen.pork': 'Babi (豚肉)',
};

const zh_CN: Translations = {
  ...zh_TW,
  'mode.menu': '菜单翻译', 'mode.receipt': '收据翻译', 'mode.general': '万用翻译',
  'mode.menu.desc': 'AI 翻译并生成点餐界面', 'mode.receipt.desc': '扫描收据，翻译明细', 'mode.general.desc': '签诗、告示、标志翻译',
  'camera.shoot': '拍照', 'camera.upload': '上传照片',
  'checkout.title': '结账确认', 'checkout.confirm': '确认点餐', 'checkout.success': '点餐成功！',
  'settings.title': '应用设置', 'settings.allergens': '过敏原设置',
  'settings.allergensHint': '选择你的过敏原，AI 会自动标记含有这些成分的菜品。',
  'history.title': '点餐记录', 'history.recent': '最近扫描',
  'receipt.addExpense': '加入记账簿', 'receipt.added': '已加入记账簿',
  'expenses.title': '记账簿',
  'recommended': '推荐',
};

const allTranslations: Record<string, Translations> = {
  'zh-TW': zh_TW, 'zh-CN': zh_CN, en, fr, es, de, ko, th, vi, 'id': id_ID,
};

// Get translation with fallback chain: lang → en → zh-TW → key
export const getT = (lang: string) => {
  const translations = allTranslations[lang] || {};
  return (key: string): string => {
    return translations[key] || en[key] || zh_TW[key] || key;
  };
};
