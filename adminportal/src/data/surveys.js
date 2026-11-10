// Survey disaster assessment presets and options
export const SURVEY_TEMPLATES = [
  {
    id: 'flood_assessment',
    name: 'Flood Damage Assessment',
    category: 'flood',
    title: 'Emergency Flood Damage & Field Status Assessment',
    description: 'Rapid assessment for agrarian services following intense rainfall and river/tank spillway discharge.',
    translations: {
      si: {
        title: 'හදිසි ගංවතුරෙන් වගාවට වූ හානිය සහ කුඹුරේ තත්ත්වය පිළිබඳ තක්සේරුව',
        description: 'අධික වර්ෂාවෙන් හෝ ගඟේ හා වැවේ වාන් දොරටු හරහා ජලය පිටවීමෙන් පසු ගොවිජන සේවා සඳහා කරන ඉක්මන් තක්සේරුවකි.',
      },
      ta: {
        title: 'வெள்ளத்தால் பயிர்களுக்கு ஏற்பட்ட சேதம் மற்றும் வயல் நிலை பற்றிய அவசர மதிப்பீடு',
        description: 'கனமழை அல்லது ஆறு, குளத்தின் வான் பாய்வுக்குப் பிறகு கமநல சேவைகளுக்காக மேற்கொள்ளப்படும் விரைவான மதிப்பீடு.',
      },
    },
    questions: [
      {
        question_text: 'What is the current condition of your paddy/crops?',
        question_type: 'choice',
        options: ['No damage (Safe)', 'Partially submerged (Water draining)', 'Completely submerged (>24 hours)'],
        translations: {
          si: {
            question_text: 'ඔබේ කුඹුරේ හෝ වගාවේ වත්මන් තත්ත්වය කුමක්ද?',
            options: ['හානියක් නැත (ආරක්ෂිතයි)', 'කොටසක් ජලයෙන් යටවී ඇත (ජලය බැස යමින් පවතී)', 'පැය 24කට වැඩි කාලයක් සම්පූර්ණයෙන් ජලයෙන් යටවී ඇත'],
          },
          ta: {
            question_text: 'உங்கள் நெல் வயல் அல்லது பயிர்களின் தற்போதைய நிலை என்ன?',
            options: ['சேதமில்லை (பாதுகாப்பாக உள்ளது)', 'பகுதியளவு நீரில் மூழ்கியுள்ளது (நீர் வடிந்து வருகிறது)', '24 மணிநேரத்திற்கும் மேலாக முழுமையாக நீரில் மூழ்கியுள்ளது'],
          },
        },
        required: true,
      },
      {
        question_text: 'Estimated submerged/damaged land area in acres',
        question_type: 'number',
        translations: {
          si: { question_text: 'ජලයෙන් යටවූ හෝ හානි වූ භූමි ප්‍රමාණය අක්කරවලින් ඇස්තමේන්තු කරන්න' },
          ta: { question_text: 'நீரில் மூழ்கிய அல்லது சேதமடைந்த நிலத்தின் மதிப்பிடப்பட்ட பரப்பளவு (ஏக்கரில்)' },
        },
        required: true,
      },
      {
        question_text: 'Is your field currently accessible by vehicle or on foot?',
        question_type: 'yes_no',
        translations: {
          si: { question_text: 'දැනට ඔබේ කුඹුරට වාහනයකින් හෝ පයින් ළඟා විය හැකිද?' },
          ta: { question_text: 'தற்போது உங்கள் வயலுக்கு வாகனத்தில் அல்லது நடந்துசெல்ல அணுக முடியுமா?' },
        },
        required: true,
      },
      {
        question_text: 'What emergency agrarian assistance do you urgently require?',
        question_type: 'multi_choice',
        options: [
          'Emergency seed paddy (short-season)',
          'Water pump / Drainage clearing',
          'Fertilizer subsidy voucher',
          'Field bund repair assistance',
          'Drinking water / Relief rations',
        ],
        translations: {
          si: {
            question_text: 'ඔබට හදිසියේ අවශ්‍ය ගොවිජන සහාය කුමක්ද?',
            options: [
              'හදිසි බීජ වී (කෙටි කාලීන)',
              'ජල පොම්පයක් / ජලය බැස යන මාර්ග පිරිසිදු කිරීම',
              'පොහොර සහනාධාර වවුචරයක්',
              'කුඹුරු නියර අලුත්වැඩියා සහාය',
              'පානීය ජලය / සහනාධාර ආහාර',
            ],
          },
          ta: {
            question_text: 'உங்களுக்கு அவசரமாகத் தேவைப்படும் கமநல உதவி எது?',
            options: [
              'அவசர விதை நெல் (குறுகிய கால வகை)',
              'நீர் இறைக்கும் பம்ப் / வடிகால் துப்புரவு',
              'உர மானிய வவுச்சர்',
              'வயல் வரம்பு அணையைச் சீரமைக்கும் உதவி',
              'குடிநீர் / நிவாரண உணவுப் பொருட்கள்',
            ],
          },
        },
        required: false,
      },
      {
        question_text: 'Additional remarks on local damage or immediate field needs',
        question_type: 'text',
        translations: {
          si: { question_text: 'ප්‍රදේශයේ හානිය හෝ කුඹුරට වහාම අවශ්‍ය දේ පිළිබඳ අමතර තොරතුරු' },
          ta: { question_text: 'உங்கள் பகுதியில் ஏற்பட்ட சேதம் அல்லது வயலுக்கு உடனடியாகத் தேவைப்படுவது பற்றிய கூடுதல் குறிப்புகள்' },
        },
        required: false,
      },
    ],
  },
  {
    id: 'drought_impact',
    name: 'Drought & Water Shortage Impact',
    category: 'drought',
    title: 'Agrarian Drought Impact & Crop Stress Survey',
    description: 'Evaluating irrigation water inadequacy and emergency water bowser/pump needs.',
    translations: {
      si: {
        title: 'නියඟයේ බලපෑම සහ වගාවට ඇති ජල හිඟය පිළිබඳ සමීක්ෂණය',
        description: 'වාරි ජල හිඟය සහ හදිසි ජල බවුසරයක හෝ ජල පොම්පයක අවශ්‍යතාව තක්සේරු කිරීම.',
      },
      ta: {
        title: 'வறட்சியின் தாக்கம் மற்றும் பயிர் பாதிப்பு பற்றிய கணக்கெடுப்பு',
        description: 'நீர்ப்பாசன நீர் பற்றாக்குறை மற்றும் அவசர நீர் பவுசர் அல்லது பம்ப் தேவையை மதிப்பிடுதல்.',
      },
    },
    questions: [
      {
        question_text: 'How adequate is the canal/tank water reaching your field?',
        question_type: 'choice',
        options: ['Sufficient for normal watering', 'Severely restricted / rotational', 'Completely dry for over 7 days'],
        translations: {
          si: {
            question_text: 'ඔබේ කුඹුරට ලැබෙන ඇළේ හෝ වැවේ ජලය ප්‍රමාණවත්ද?',
            options: ['සාමාන්‍ය ජල සැපයුමට ප්‍රමාණවත්ය', 'දැඩි ලෙස සීමා කර ඇත / වාරයෙන් වාරයට ලැබේ', 'දින 7කට වැඩි කාලයක් සම්පූර්ණයෙන් වියළිය'],
          },
          ta: {
            question_text: 'உங்கள் வயலுக்கு வரும் கால்வாய் அல்லது குளத்து நீர் எவ்வளவு போதுமானது?',
            options: ['வழக்கமான பாசனத்திற்கு போதுமானது', 'கடுமையாகக் கட்டுப்படுத்தப்பட்டுள்ளது / முறைப்படி வழங்கப்படுகிறது', '7 நாட்களுக்கும் மேலாக முற்றிலும் நீர் இல்லை'],
          },
        },
        required: true,
      },
      {
        question_text: 'Crop health condition under current dry spell',
        question_type: 'choice',
        options: ['Normal growth', 'Showing wilting / yellowing', 'Severe stunted growth / Total failure'],
        translations: {
          si: {
            question_text: 'දැනට පවතින වියළි කාලගුණය යටතේ වගාවේ සෞඛ්‍ය තත්ත්වය කුමක්ද?',
            options: ['සාමාන්‍ය වර්ධනය', 'මැලවීම හෝ කහ පැහැ වීම පෙනේ', 'දැඩි වර්ධන බාලවීම / වගාව සම්පූර්ණයෙන්ම විනාශ වී ඇත'],
          },
          ta: {
            question_text: 'தற்போதைய வறட்சியில் பயிரின் நிலை என்ன?',
            options: ['வழக்கமான வளர்ச்சி', 'வாடுதல் / மஞ்சளாதல் காணப்படுகிறது', 'கடுமையான வளர்ச்சி குன்றல் / பயிர் முற்றிலும் அழிந்துள்ளது'],
          },
        },
        required: true,
      },
      {
        question_text: 'Do you have an agro-well or tube well with working water?',
        question_type: 'yes_no',
        translations: {
          si: { question_text: 'ජලය ඇති, ක්‍රියාත්මක කෘෂි ළිඳක් හෝ නළ ළිඳක් ඔබට තිබේද?' },
          ta: { question_text: 'நீர் உள்ள, இயங்கக்கூடிய விவசாயக் கிணறு அல்லது குழாய் கிணறு உங்களிடம் உள்ளதா?' },
        },
        required: true,
      },
      {
        question_text: 'Urgent drought relief measures requested',
        question_type: 'multi_choice',
        options: [
          'Emergency water bowser distribution',
          'Fuel/kerosene quota for water pumping',
          'Drought-tolerant crop seed supply',
          'Crop insurance claim assessment',
        ],
        translations: {
          si: {
            question_text: 'නියඟ සහන සඳහා ඔබ ඉල්ලා සිටින හදිසි පියවර මොනවාද?',
            options: [
              'හදිසි ජල බවුසර් බෙදාහැරීම',
              'ජලය පොම්ප කිරීමට ඉන්ධන / භූමිතෙල් කෝටාව',
              'නියඟයට ඔරොත්තු දෙන බෝග බීජ සැපයීම',
              'වගා රක්ෂණ හිමිකම් තක්සේරුව',
            ],
          },
          ta: {
            question_text: 'வறட்சி நிவாரணத்திற்காக நீங்கள் கோரும் அவசர நடவடிக்கைகள் எவை?',
            options: [
              'அவசர நீர் பவுசர் விநியோகம்',
              'நீர் இறைக்க எரிபொருள் / மண்ணெண்ணெய் ஒதுக்கீடு',
              'வறட்சியைத் தாங்கும் பயிர் விதைகள் வழங்குதல்',
              'பயிர்க் காப்புறுதி கோரிக்கையை மதிப்பிடுதல்',
            ],
          },
        },
        required: false,
      },
      {
        question_text: 'Specific field remarks or well depth notes',
        question_type: 'text',
        translations: {
          si: { question_text: 'කුඹුර පිළිබඳ විශේෂ තොරතුරු හෝ ළිඳේ ගැඹුර පිළිබඳ සටහන්' },
          ta: { question_text: 'வயல் பற்றிய குறிப்புகள் அல்லது கிணற்றின் ஆழம் பற்றிய தகவல்கள்' },
        },
        required: false,
      },
    ],
  },
  {
    id: 'pest_outbreak',
    name: 'Pest / Crop Disease Outbreak',
    category: 'pest',
    title: 'Crop Pest & Disease Outbreak Alert Survey',
    description: 'Gathering immediate intelligence on pest infestations (e.g. Sena caterpillar, Brown Planthopper).',
    translations: {
      si: {
        title: 'වගා පළිබෝධ සහ රෝග පැතිරීම පිළිබඳ හදිසි සමීක්ෂණය',
        description: 'සේනා දළඹුවා සහ දුඹුරු පැළ කීඩෑවා වැනි පළිබෝධ පැතිරීම පිළිබඳ තොරතුරු ඉක්මනින් රැස් කිරීම.',
      },
      ta: {
        title: 'பயிர்ப் பூச்சி மற்றும் நோய்ப் பரவல் பற்றிய அவசரக் கணக்கெடுப்பு',
        description: 'பூச்சித் தாக்குதல் பற்றிய உடனடித் தகவல்களைச் சேகரித்தல் (எ.கா. சேனா கம்பளிப்புழு, பழுப்புத் தத்துப்பூச்சி).',
      },
    },
    questions: [
      {
        question_text: 'Which pest or crop disease have you observed?',
        question_type: 'choice',
        options: [
          'Fall Armyworm (Sena caterpillar)',
          'Brown Planthopper (BPH)',
          'Paddy Blast (Kandu Rogaya)',
          'Gall Midge / Thrips',
          'Other unidentified pest',
        ],
        translations: {
          si: {
            question_text: 'ඔබ දුටු පළිබෝධය හෝ වගා රෝගය කුමක්ද?',
            options: [
              'සේනා දළඹුවා',
              'දුඹුරු පැළ කීඩෑවා (BPH)',
              'වී කරල් අංගමාරය (කන්දු රෝගය)',
              'ගෝල් මිජ් / පැළ මැක්කා',
              'හඳුනා නොගත් වෙනත් පළිබෝධයක්',
            ],
          },
          ta: {
            question_text: 'நீங்கள் கண்ட பூச்சி அல்லது பயிர் நோய் எது?',
            options: [
              'சேனா கம்பளிப்புழு',
              'பழுப்புத் தத்துப்பூச்சி (BPH)',
              'நெல் குலை நோய்',
              'கால் ஈ / திரிப்ஸ்',
              'அடையாளம் தெரியாத வேறு பூச்சி',
            ],
          },
        },
        required: true,
      },
      {
        question_text: 'Estimated infested area in acres',
        question_type: 'number',
        translations: {
          si: { question_text: 'පළිබෝධය පැතිර ඇති භූමි ප්‍රමාණය අක්කරවලින් ඇස්තමේන්තු කරන්න' },
          ta: { question_text: 'பூச்சி தாக்கியுள்ள நிலத்தின் மதிப்பிடப்பட்ட பரப்பளவு (ஏக்கரில்)' },
        },
        required: true,
      },
      {
        question_text: 'Have you notified your local Agrarian Development Officer (ARPA)?',
        question_type: 'yes_no',
        translations: {
          si: { question_text: 'ඔබේ ප්‍රදේශයේ ගොවිජන සංවර්ධන නිලධාරියාට (ARPA) ඔබ දැනුම් දී තිබේද?' },
          ta: { question_text: 'உங்கள் பகுதி கமநல அபிவிருத்தி உத்தியோகத்தருக்கு (ARPA) அறிவித்துள்ளீர்களா?' },
        },
        required: true,
      },
      {
        question_text: 'Are recommended insecticides/fungicides available in your local agrarian store?',
        question_type: 'yes_no',
        translations: {
          si: { question_text: 'නිර්දේශිත කෘමිනාශක හෝ දිලීරනාශක ඔබේ ප්‍රදේශයේ ගොවිජන සේවා මධ්‍යස්ථානයේ තිබේද?' },
          ta: { question_text: 'பரிந்துரைக்கப்பட்ட பூச்சிக்கொல்லிகள் அல்லது பூஞ்சைக்கொல்லிகள் உங்கள் பகுதி கமநல சேவை நிலையத்தில் உள்ளனவா?' },
        },
        required: false,
      },
      {
        question_text: 'Describe symptoms observed or crop stage (e.g., tillering, booting)',
        question_type: 'text',
        translations: {
          si: { question_text: 'ඔබ දුටු ලක්ෂණ හෝ වගාවේ වර්ධන අවධිය (උදා: පඳුරු දැමීම, ගොයම් කැනීම) විස්තර කරන්න' },
          ta: { question_text: 'கண்ட அறிகுறிகள் அல்லது பயிரின் வளர்ச்சிப் பருவத்தை (எ.கா. தூர்கள் உருவாகுதல், கதிர் வெளிவருதல்) விவரிக்கவும்' },
        },
        required: false,
      },
    ],
  },
  {
    id: 'seed_aid',
    name: 'Emergency Seed & Replanting Aid',
    category: 'disaster',
    title: 'Emergency Seed Paddy & Replanting Readiness Survey',
    description: 'Identifying farmers requiring certified seed paddy for secondary cultivation after crop damage.',
    translations: {
      si: {
        title: 'හදිසි බීජ වී සහ නැවත වගා කිරීමේ සූදානම පිළිබඳ සමීක්ෂණය',
        description: 'වගා හානියෙන් පසු නැවත වගා කිරීමට සහතික කළ බීජ වී අවශ්‍ය ගොවීන් හඳුනා ගැනීම.',
      },
      ta: {
        title: 'அவசர விதை நெல் மற்றும் மீள்நடுகைக்கான தயார்நிலை கணக்கெடுப்பு',
        description: 'பயிர்ச் சேதத்திற்குப் பிறகு மீண்டும் பயிரிடச் சான்றளிக்கப்பட்ட விதை நெல் தேவைப்படும் விவசாயிகளை அடையாளம் காணுதல்.',
      },
    },
    questions: [
      {
        question_text: 'Are you planning to replant if certified seed paddy is provided?',
        question_type: 'yes_no',
        translations: {
          si: { question_text: 'සහතික කළ බීජ වී ලබා දුනහොත් ඔබ නැවත වගා කිරීමට සැලසුම් කරනවාද?' },
          ta: { question_text: 'சான்றளிக்கப்பட்ட விதை நெல் வழங்கப்பட்டால் மீண்டும் பயிரிடத் திட்டமிட்டுள்ளீர்களா?' },
        },
        required: true,
      },
      {
        question_text: 'Preferred seed variety for quick recovery',
        question_type: 'choice',
        options: ['Bg 352 (3.5 months)', 'Bg 300 (3 months)', 'At 362 (3.5 months)', 'Alternative crop (Mung / Maize)'],
        translations: {
          si: {
            question_text: 'ඉක්මනින් නැවත වගා කිරීමට ඔබ කැමති බීජ වර්ගය කුමක්ද?',
            options: ['Bg 352 (මාස 3.5)', 'Bg 300 (මාස 3)', 'At 362 (මාස 3.5)', 'විකල්ප බෝගයක් (මුං / බඩඉරිඟු)'],
          },
          ta: {
            question_text: 'விரைவாக மீண்டும் பயிரிட நீங்கள் விரும்பும் விதை வகை எது?',
            options: ['Bg 352 (3.5 மாதங்கள்)', 'Bg 300 (3 மாதங்கள்)', 'At 362 (3.5 மாதங்கள்)', 'மாற்றுப் பயிர் (பாசிப்பயறு / மக்காச்சோளம்)'],
          },
        },
        required: true,
      },
      {
        question_text: 'Land extent prepared/ready for replanting (acres)',
        question_type: 'number',
        translations: {
          si: { question_text: 'නැවත වගා කිරීමට සූදානම් කළ භූමි ප්‍රමාණය (අක්කර)' },
          ta: { question_text: 'மீள்நடுகைக்குத் தயாராக உள்ள நிலப்பரப்பு (ஏக்கரில்)' },
        },
        required: true,
      },
      {
        question_text: 'Preferred Agrarian Services Center for seed collection',
        question_type: 'text',
        translations: {
          si: { question_text: 'බීජ ලබා ගැනීමට ඔබ කැමති ගොවිජන සේවා මධ්‍යස්ථානය' },
          ta: { question_text: 'விதைகளைப் பெற்றுக்கொள்ள நீங்கள் விரும்பும் கமநல சேவை நிலையம்' },
        },
        required: false,
      },
    ],
  },
  {
    id: 'custom',
    name: 'Custom / Blank Survey',
    category: 'general',
    title: '',
    description: '',
    questions: [
      {
        question_text: '',
        question_type: 'choice',
        options: ['Option 1', 'Option 2'],
        required: true,
      },
    ],
  },
]

export const CATEGORY_TONE = {
  flood: 'info',
  drought: 'warning',
  pest: 'critical',
  disaster: 'critical',
  general: 'neutral',
}
