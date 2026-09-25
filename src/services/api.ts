import type {
  AnalyzeRequest,
  AnalysisResult,
  TranscribeRequest,
  TranscribeResponse,
  HistoryItem,
  PossibleCause,
  EvidenceSource,
  ActionStep,
  ConfidenceLevel,
  CropType,
  LanguageCode,
} from '@/types';
import { getAnonymousUserId, getStoredUserHistory } from '@/services/identity';
import { fetchWeatherData, searchLocations, DEFAULT_FARM_LOCATION } from '@/services/weather';


// ─── Mock Data ───────────────────────────────────────────────────────
// This module simulates the backend API. Each function returns a Promise
// that resolves after a realistic delay. To connect the real backend,
// replace the mock bodies with `fetch()` calls to the corresponding endpoints:
//
//   analyzeInput  → POST /api/analyze
//   transcribeAudio → POST /api/transcribe
//   getHistory    → GET  /api/history
//   getWeather    → GET  /api/weather
//
// The response shapes already match the expected API contract.

const MOCK_DELAY = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ─── Mock Possible Causes ─────────────────────────────────────────────

const mockCauses: PossibleCause[] = [
  {
    id: 'cause-1',
    name: 'Leaf Blight (Bacterial)',
    nameLocalized: {
      en: 'Leaf Blight (Bacterial)',
      hi: 'पत्ती ब्लाइट (जीवाणु)',
      pa: 'ਪੱਤਾ ਬਲਾਈਟ (ਬੈਕਟੀਰੀਆ)',
    },
    category: 'disease',
    description:
      'Bacterial leaf blight is a common disease causing water-soaked lesions on leaves that expand and turn yellow-brown. It thrives in warm, humid conditions and spreads through rain splash and irrigation water.',
    descriptionLocalized: {
      en: 'Bacterial leaf blight is a common disease causing water-soaked lesions on leaves that expand and turn yellow-brown. It thrives in warm, humid conditions and spreads through rain splash and irrigation water.',
      hi: 'जीवाणु पत्ती ब्लाइट एक आम रोग है जो पत्तियों पर जल-भिग्न घाव बनाता है जो फैलकर पीले-भूरे हो जाते हैं। यह गर्म, नमी वाली स्थितियों में फलता-फूलता है।',
      pa: 'ਬੈਕਟੀਰੀਆ ਪੱਤਾ ਬਲਾਈਟ ਇੱਕ ਆਮ ਰੋਗ ਹੈ ਜੋ ਪੱਤਿਆਂ ਤੇ ਜਲ-ਭਿੱਜ ਜ਼ਖ਼ਮ ਬਣਾਉਂਦਾ ਹੈ ਜੋ ਫੈਲ ਕੇ ਪੀਲੇ-ਭੂਰੇ ਹੋ ਜਾਂਦੇ ਹਨ।',
    },
    likelihood: 'high',
    symptoms: [
      'Water-soaked lesions on leaf margins',
      'Yellow halo surrounding lesions',
      'Lesions expand and turn brown',
      'Leaf curling and wilting in advanced stages',
    ],
    symptomsLocalized: {
      en: [
        'Water-soaked lesions on leaf margins',
        'Yellow halo surrounding lesions',
        'Lesions expand and turn brown',
        'Leaf curling and wilting in advanced stages',
      ],
      hi: [
        'पत्ती किनारों पर जल-भिग्न घाव',
        'घाव के चारों ओर पीला हेलो',
        'घाव फैलकर भूरे हो जाते हैं',
        'उन्नत अवस्था में पत्तियों का मुड़ना और मुरझाना',
      ],
      pa: [
        'ਪੱਤਾ ਕਿਨਾਰਿਆਂ ਤੇ ਜਲ-ਭਿੱਗ ਜ਼ਖ਼ਮ',
        'ਜ਼ਖ਼ਮ ਦੇ ਦੁਆਲੇ ਪੀਲਾ ਹੇਲੋ',
        'ਜ਼ਖ਼ਮ ਫੈਲ ਕੇ ਭੂਰੇ ਹੋ ਜਾਂਦੇ ਹਨ',
        'ਅਗਲੀ ਅਵਸਥਾ ਵਿੱਚ ਪੱਤਿਆਂ ਦਾ ਮੁੜਨਾ ਅਤੇ ਮੁਰਝਾਉਣਾ',
      ],
    },
  },
  {
    id: 'cause-2',
    name: 'Nitrogen Deficiency',
    nameLocalized: {
      en: 'Nitrogen Deficiency',
      hi: 'नाइट्रोजन की कमी',
      pa: 'ਨਾਈਟ੍ਰੋਜਨ ਦੀ ਘਾਟ',
    },
    category: 'nutrient',
    description:
      'Nitrogen deficiency causes older leaves to yellow (chlorosis) starting from the tips, with stunted growth and pale green appearance in younger leaves. Common in sandy or heavily leached soils.',
    descriptionLocalized: {
      en: 'Nitrogen deficiency causes older leaves to yellow (chlorosis) starting from the tips, with stunted growth and pale green appearance in younger leaves. Common in sandy or heavily leached soils.',
      hi: 'नाइट्रोजन की कमी से पुरानी पत्तियां पीली (क्लोरोसिस) हो जाती हैं, विकास रुक जाता है, और नई पत्तियां हल्की हरी दिखती हैं।',
      pa: 'ਨਾਈਟ੍ਰੋਜਨ ਦੀ ਘਾਟ ਨਾਲ ਪੁਰਾਣੇ ਪੱਤੇ ਪੀਲੇ (ਕਲੋਰੋਸਿਸ) ਹੋ ਜਾਂਦੇ ਹਨ, ਵਾਧਾ ਰੁਕ ਜਾਂਦਾ ਹੈ, ਅਤੇ ਨਵੇਂ ਪੱਤੇ ਹਲਕੇ ਹਰੇ ਦਿਸਦੇ ਹਨ।',
    },
    likelihood: 'medium',
    symptoms: [
      'Yellowing of older leaves starting from tips',
      'Stunted plant growth',
      'Pale green younger leaves',
      'Reduced tillering or branching',
    ],
    symptomsLocalized: {
      en: [
        'Yellowing of older leaves starting from tips',
        'Stunted plant growth',
        'Pale green younger leaves',
        'Reduced tillering or branching',
      ],
      hi: [
        'पुरानी पत्तियों का सिरों से पीला होना',
        'पौधे का रुका हुआ विकास',
        'नई पत्तियां हल्की हरी',
        'टिलरिंग या शाखाओं में कमी',
      ],
      pa: [
        'ਪੁਰਾਣੇ ਪੱਤਿਆਂ ਦਾ ਸਿਰਿਆਂ ਤੋਂ ਪੀਲਾ ਹੋਣਾ',
        'ਬੂਟੇ ਦਾ ਰੁਕਿਆ ਵਾਧਾ',
        'ਨਵੇਂ ਪੱਤੇ ਹਲਕੇ ਹਰੇ',
        'ਟਿਲਰਿੰਗ ਜਾਂ ਸ਼ਾਖਾਵਾਂ ਵਿੱਚ ਕਮੀ',
      ],
    },
  },
  {
    id: 'cause-3',
    name: 'Brown Plant Hopper',
    nameLocalized: {
      en: 'Brown Plant Hopper',
      hi: 'भूरा पौधा हॉपर',
      pa: 'ਭੂਰਾ ਬੂਟਾ ਹੌਪਰ',
    },
    category: 'pest',
    description:
      'Brown plant hoppers are sap-sucking insects that cause hopperburn — leaves turn yellow-brown and dry. They congregate at the base of the plant and can cause sudden wilting in large patches.',
    descriptionLocalized: {
      en: 'Brown plant hoppers are sap-sucking insects that cause hopperburn — leaves turn yellow-brown and dry. They congregate at the base of the plant and can cause sudden wilting in large patches.',
      hi: 'भूरे पौधा हॉपर रस चूसने वाले कीट हैं जो हॉपरबर्न का कारण बनते हैं — पत्तियां पीली-भूरी और सूखी हो जाती हैं।',
      pa: 'ਭੂਰੇ ਬੂਟਾ ਹੌਪਰ ਰਸ ਚੂਸਣ ਵਾਲੇ ਕੀਟ ਹਨ ਜੋ ਹੌਪਰਬਰਨ ਦਾ ਕਾਰਨ ਬਣਦੇ ਹਨ — ਪੱਤੇ ਪੀਲੇ-ਭੂਰੇ ਅਤੇ ਸੁੱਕੇ ਹੋ ਜਾਂਦੇ ਹਨ।',
    },
    likelihood: 'low',
    symptoms: [
      'Yellowing and browning of leaves',
      'Sudden wilting in patches',
      'Insects visible at plant base',
      'Honeydew or sooty mold on lower stems',
    ],
    symptomsLocalized: {
      en: [
        'Yellowing and browning of leaves',
        'Sudden wilting in patches',
        'Insects visible at plant base',
        'Honeydew or sooty mold on lower stems',
      ],
      hi: [
        'पत्तियों का पीला और भूरा होना',
        'पैचों में अचानक मुरझाना',
        'पौधे के आधार पर दिखाई देने वाले कीट',
        'निचले तनों पर मधु या काला फफूंद',
      ],
      pa: [
        'ਪੱਤਿਆਂ ਦਾ ਪੀਲਾ ਅਤੇ ਭੂਰਾ ਹੋਣਾ',
        'ਪੈਂਚਾਂ ਵਿੱਚ ਅਚਾਨਕ ਮੁਰਝਾਉਣਾ',
        'ਬੂਟੇ ਦੇ ਆਧਾਰ ਤੇ ਦਿੱਸਣ ਵਾਲੇ ਕੀਟ',
        'ਹੇਠਲੇ ਤਣਿਆਂ ਤੇ ਮਧੂ ਜਾਂ ਕਾਲਾ ਫਫੌਂਦ',
      ],
    },
  },
];

const mockSources: EvidenceSource[] = [
  {
    id: 'src-1',
    title: 'ICAR-Indian Institute of Rice Research: Bacterial Leaf Blight Management',
    source: 'ICAR-IIRR',
    url: 'https://www.icar.org.in',
    snippet:
      'Bacterial leaf blight (BLB) caused by Xanthomonas oryzae pv. oryzae is one of the most serious diseases of rice. Initial symptoms appear as water-soaked stripes on leaf margins that enlarge and turn yellow.',
    relevance: 'high',
  },
  {
    id: 'src-2',
    title: 'Plant Nutrient Deficiencies in Field Crops — A Diagnostic Guide',
    source: 'FAO Agricultural Bulletin',
    url: 'https://www.fao.org',
    snippet:
      'Nitrogen deficiency manifests as chlorosis beginning in older leaves, progressing to younger growth. Stunted growth and reduced tillering are characteristic symptoms in cereal crops.',
    relevance: 'medium',
  },
  {
    id: 'src-3',
    title: 'Brown Plant Hopper: Ecology and Integrated Pest Management',
    source: 'IRRI Knowledge Bank',
    url: 'https://www.knowledgebank.irri.org',
    snippet:
      'Brown plant hopper (BPH) causes hopperburn, characterized by yellowing and drying of leaves. Heavy infestations can cause complete crop loss in affected patches within days.',
    relevance: 'low',
  },
];

const mockActionPlan: ActionStep[] = [
  {
    id: 'action-1',
    step: 1,
    title: 'Remove and destroy affected leaves',
    titleLocalized: {
      en: 'Remove and destroy affected leaves',
      hi: 'प्रभावित पत्तियों को हटाएं और नष्ट करें',
      pa: 'ਪ੍ਰਭਾਵਿਤ ਪੱਤਿਆਂ ਨੂੰ ਹਟਾਓ ਅਤੇ ਨਸ਼ਟ ਕਰੋ',
    },
    description:
      'Carefully remove and burn or bury leaves showing water-soaked lesions to reduce the spread of bacteria to healthy plants.',
    descriptionLocalized: {
      en: 'Carefully remove and burn or bury leaves showing water-soaked lesions to reduce the spread of bacteria to healthy plants.',
      hi: 'जीवाणु के प्रसार को रोकने के लिए जल-भिग्न घाव वाली पत्तियों को सावधानी से हटाएं और जला दें या दबा दें।',
      pa: 'ਬੈਕਟੀਰੀਆ ਦੇ ਫੈਲਾਅ ਨੂੰ ਰੋਕਣ ਲਈ ਜਲ-ਭਿੱਗ ਜ਼ਖ਼ਮ ਵਾਲੇ ਪੱਤਿਆਂ ਨੂੰ ਸਾਵਧਾਨੀ ਨਾਲ ਹਟਾਓ ਅਤੇ ਸਾੜੋ ਜਾਂ ਦਬਾਓ।',
    },
    priority: 'immediate',
    timeframe: 'Within 24–48 hours',
    timeframeLocalized: {
      en: 'Within 24–48 hours',
      hi: '24–48 घंटे के भीतर',
      pa: '24–48 ਘੰਟੇ ਦੇ ਅੰਦਰ',
    },
  },
  {
    id: 'action-2',
    step: 2,
    title: 'Apply copper-based bactericide spray',
    titleLocalized: {
      en: 'Apply copper-based bactericide spray',
      hi: 'तांबा-आधारित जीवाणुनाशक स्प्रे लगाएं',
      pa: 'ਤਾਂਬਾ-ਆਧਾਰਿਤ ਬੈਕਟੀਰੀਸਾਈਡ ਸਪ੍ਰੇਅ ਲਗਾਓ',
    },
    description:
      'Apply a copper oxychloride or copper hydroxide-based bactericide at recommended dosage. Spray in the early morning or late evening to avoid phytotoxicity. Repeat after 7 days if symptoms persist.',
    descriptionLocalized: {
      en: 'Apply a copper oxychloride or copper hydroxide-based bactericide at recommended dosage. Spray in the early morning or late evening to avoid phytotoxicity. Repeat after 7 days if symptoms persist.',
      hi: 'अनुशंसित खुराक पर तांबा ऑक्सीक्लोराइड या तांबा हाइड्रोक्साइड-आधारित जीवाणुनाशक लगाएं। फाइटोटॉक्सिसिटी से बचने के लिए सुबह जल्दी या शाम देर से स्प्रे करें।',
      pa: 'ਸਿਫਾਰਸ਼ੀ ਖ਼ੁਰਾਕ ਤੇ ਤਾਂਬਾ ਆਕਸੀਕਲੋਰਾਈਡ ਜਾਂ ਤਾਂਬਾ ਹਾਈਡ੍ਰੋਕਸਾਈਡ-ਆਧਾਰਿਤ ਬੈਕਟੀਰੀਸਾਈਡ ਲਗਾਓ। ਫਾਈਟੋਟਾਕਸਿਸਿਟੀ ਤੋਂ ਬਚਣ ਲਈ ਸਵੇਰੇ ਜਲਦੀ ਜਾਂ ਸ਼ਾਮ ਦੇਰ ਨਾਲ ਸਪ੍ਰੇਅ ਕਰੋ।',
    },
    priority: 'short-term',
    timeframe: 'Within 3–5 days',
    timeframeLocalized: {
      en: 'Within 3–5 days',
      hi: '3–5 दिन के भीतर',
      pa: '3–5 ਦਿਨਾਂ ਦੇ ਅੰਦਰ',
    },
  },
  {
    id: 'action-3',
    step: 3,
    title: 'Improve field drainage and reduce standing water',
    titleLocalized: {
      en: 'Improve field drainage and reduce standing water',
      hi: 'खेत की जल निकासी सुधारें और जमा पानी कम करें',
      pa: 'ਖੇਤ ਦੀ ਜਲ ਨਿਕਾਸੀ ਸੁਧਾਰੋ ਅਤੇ ਜਮਾ ਪਾਣੀ ਘਟਾਓ',
    },
    description:
      'Bacterial leaf blight spreads through water. Ensure proper drainage channels are clear and avoid overhead irrigation. Maintain field moisture without waterlogging.',
    descriptionLocalized: {
      en: 'Bacterial leaf blight spreads through water. Ensure proper drainage channels are clear and avoid overhead irrigation. Maintain field moisture without waterlogging.',
      hi: 'जीवाणु पत्ती ब्लाइट पानी से फैलता है। उचित जल निकासी चैनल सुनिश्चित करें और ओवरहेड सिंचाई से बचें।',
      pa: 'ਬੈਕਟੀਰੀਆ ਪੱਤਾ ਬਲਾਈਟ ਪਾਣੀ ਨਾਲ ਫੈਲਦਾ ਹੈ। ਉਚਿਤ ਜਲ ਨਿਕਾਸੀ ਚੈਨਲ ਯਕੀਨੀ ਬਣਾਓ ਅਤੇ ਓਵਰਹੈੱਡ ਸਿੰਚਾਈ ਤੋਂ ਬਚੋ।',
    },
    priority: 'short-term',
    timeframe: 'Within 1 week',
    timeframeLocalized: {
      en: 'Within 1 week',
      hi: '1 हफ्ते के भीतर',
      pa: '1 ਹਫ਼ਤੇ ਦੇ ਅੰਦਰ',
    },
  },
  {
    id: 'action-4',
    step: 4,
    title: 'Monitor daily and document progress',
    titleLocalized: {
      en: 'Monitor daily and document progress',
      hi: 'रोजाना निगरानी करें और प्रगति दर्ज करें',
      pa: 'ਰੋਜ਼ਾਨਾ ਨਿਗਰਾਨੀ ਕਰੋ ਅਤੇ ਤਰੱਕੀ ਦਰਜ ਕਰੋ',
    },
    description:
      'Take daily photos of the affected area and note any changes. If symptoms worsen or spread to new plants after 5 days, escalate to your local agricultural extension officer.',
    descriptionLocalized: {
      en: 'Take daily photos of the affected area and note any changes. If symptoms worsen or spread to new plants after 5 days, escalate to your local agricultural extension officer.',
      hi: 'प्रभावित क्षेत्र की रोजाना फोटो लें और किसी भी बदलाव को नोट करें। 5 दिन बाद लक्षण बिगड़ने पर स्थानीय कृषि विस्तार अधिकारी से संपर्क करें।',
      pa: 'ਪ੍ਰਭਾਵਿਤ ਖੇਤਰ ਦੀ ਰੋਜ਼ਾਨਾ ਫੋਟੋ ਲਓ ਅਤੇ ਕੋਈ ਵੀ ਬਦਲਾਅ ਨੋਟ ਕਰੋ। 5 ਦਿਨ ਬਾਅਦ ਲੱਛਣ ਵਿਗੜਣ ਤੇ ਸਥਾਨਕ ਖੇਤੀਬਾੜੀ ਵਿਸਤਾਰ ਅਧਿਕਾਰੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
    },
    priority: 'preventive',
    timeframe: 'Ongoing for 2 weeks',
    timeframeLocalized: {
      en: 'Ongoing for 2 weeks',
      hi: '2 हफ्तों ते जारी',
      pa: '2 ਹਫ਼ਤਿਆਂ ਤੱਕ ਜਾਰੀ',
    },
  },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── API Functions ───────────────────────────────────────────────────

export async function analyzeInput(req: AnalyzeRequest): Promise<AnalysisResult> {
  const userId = req.userId || getAnonymousUserId();
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...req, userId }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Analyze Input Error:', error);
    throw new Error('Failed to analyze input. Ensure the backend is running.');
  }
}

export async function transcribeAudio(req: TranscribeRequest): Promise<TranscribeResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Transcribe Error:', error);
    throw new Error('Failed to transcribe audio. Ensure the backend is running.');
  }
}

/**
 * Fetches diagnosis history filtered strictly by userId.
 * Never leaks cross-user data.
 */
export async function getHistory(userId?: string): Promise<HistoryItem[]> {
  await delay(300);
  const effectiveUserId = userId || getAnonymousUserId();
  const stored = getStoredUserHistory(effectiveUserId);

  return stored.map((item) => ({
    id: item.id,
    userId: item.userId || effectiveUserId,
    cropType: item.cropType,
    cropTypeLocalized: item.cropTypeLocalized,
    confidence_level: item.confidence_level,
    summary: item.summary,
    summaryLocalized: item.summaryLocalized,
    createdAt: item.createdAt,
    possible_causes_count: item.possible_causes.length,
    escalation_flag: item.escalation_flag,
    thumbnailUrl: item.imageDataUrl,
  }));
}

/**
 * Fetches real weather data from Open-Meteo for the specified location or default coordinates.
 */
export async function getWeather(locationQuery?: string): Promise<{
  temperature: number;
  humidity: number;
  condition: string;
  windSpeed: number;
  rainfall: number;
  location: string;
}> {
  try {
    let lat = DEFAULT_FARM_LOCATION.latitude;
    let lon = DEFAULT_FARM_LOCATION.longitude;
    let locName = `${DEFAULT_FARM_LOCATION.name}, ${DEFAULT_FARM_LOCATION.region}`;

    if (locationQuery && locationQuery.trim().length > 1) {
      const suggestions = await searchLocations(locationQuery);
      if (suggestions.length > 0) {
        lat = suggestions[0].latitude;
        lon = suggestions[0].longitude;
        locName = `${suggestions[0].name}, ${suggestions[0].region || suggestions[0].country}`;
      }
    }

    const live = await fetchWeatherData(lat, lon, locName);
    return {
      temperature: live.current.temperature,
      humidity: live.current.humidity,
      condition: live.current.condition,
      windSpeed: live.current.windSpeed,
      rainfall: live.current.rainChance,
      location: locName,
    };
  } catch (err) {
    console.warn('[API] Fallback for weather request:', err);
    return {
      temperature: 28,
      humidity: 68,
      condition: 'Partly Cloudy',
      windSpeed: 10,
      rainfall: 15,
      location: locationQuery || `${DEFAULT_FARM_LOCATION.name}, ${DEFAULT_FARM_LOCATION.region}`,
    };
  }
}

