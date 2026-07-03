// answer: true = утверждение верно, false = утверждение неверно
const QUESTIONS = [
  {
    id: 1,
    category: 'biology',
    answer: false,
    ru: {
      statement: 'Страусы прячут голову в песок при опасности.',
      explain: 'Миф. Страусы наклоняют голову к земле, переворачивая яйца в гнезде, — со стороны кажется, будто прячут.',
    },
    en: {
      statement: 'Ostriches bury their heads in the sand when in danger.',
      explain: 'Myth. Ostriches lower their heads to turn eggs in the nest — from a distance it looks like hiding.',
    },
  },
  {
    id: 2,
    category: 'space',
    answer: true,
    ru: {
      statement: 'Сатурн настолько лёгкий, что не утонул бы в воде — он бы всплыл.',
      explain: 'Средняя плотность Сатурна ~0.69 г/см³, меньше воды. Гигантский шар из газа плавал бы.',
    },
    en: {
      statement: "Saturn is so light it wouldn't sink in water — it would float.",
      explain: "Saturn's average density is ~0.69 g/cm³, less than water. The giant gas ball would float.",
    },
  },
  {
    id: 3,
    category: 'history',
    answer: true,
    ru: {
      statement: 'Клеопатра жила ближе по времени к первому айфону, чем к постройке пирамиды Хеопса.',
      explain: 'Пирамида ~2560 до н.э., Клеопатра ~30 до н.э., айфон 2007. Разрыв до пирамиды больше.',
    },
    en: {
      statement: 'Cleopatra lived closer in time to the first iPhone than to the building of the Great Pyramid.',
      explain: 'The pyramid ~2560 BCE, Cleopatra ~30 BCE, iPhone 2007. The gap to the pyramid is bigger.',
    },
  },
  {
    id: 4,
    category: 'biology',
    answer: false,
    ru: {
      statement: 'Кровь человека в венах синяя, пока не соприкоснётся с кислородом.',
      explain: 'Венозная кровь тёмно-красная. Синими вены кажутся из-за того, как кожа рассеивает свет.',
    },
    en: {
      statement: 'Blood in human veins is blue until it touches oxygen.',
      explain: 'Venous blood is dark red. Veins look blue because of how skin scatters light.',
    },
  },
  {
    id: 5,
    category: 'history',
    answer: true,
    ru: {
      statement: 'В Африке есть страна, где пирамид больше, чем в Египте.',
      explain: 'Судан: нубийских пирамид там ~200–255, больше, чем египетских (~120–140).',
    },
    en: {
      statement: "There's an African country with more pyramids than Egypt.",
      explain: "Sudan: roughly 200–255 Nubian pyramids, more than Egypt's ~120–140.",
    },
  },
  {
    id: 6,
    category: 'botany',
    answer: true,
    ru: {
      statement: 'Банан с точки зрения ботаники — это ягода, а клубника — нет.',
      explain: 'Банан подходит под определение ягоды, клубника — «ложный плод». Ботаника контринтуитивна.',
    },
    en: {
      statement: "Botanically, a banana is a berry, but a strawberry isn't.",
      explain: 'A banana fits the botanical definition of a berry; a strawberry is an "accessory fruit". Botany is counterintuitive.',
    },
  },
  {
    id: 7,
    category: 'history',
    answer: false,
    ru: {
      statement: 'Наполеон был необычно низкого роста.',
      explain: 'Рост ~1.68–1.70 м — средний для француза той эпохи. Миф из-за путаницы дюймов и пропаганды.',
    },
    en: {
      statement: 'Napoleon was unusually short.',
      explain: 'He was ~1.68–1.70 m — average for a Frenchman of that era. The myth comes from a units mix-up and propaganda.',
    },
  },
  {
    id: 8,
    category: 'biology',
    answer: true,
    ru: {
      statement: 'Человек и гриб-шампиньон — более близкие родственники, чем гриб и растение.',
      explain: 'Грибы ближе к животным, чем к растениям: общий предок с животными позже, чем с растениями.',
    },
    en: {
      statement: 'Humans are more closely related to mushrooms than mushrooms are to plants.',
      explain: 'Fungi are closer to animals than to plants — their common ancestor with animals is more recent.',
    },
  },
  {
    id: 9,
    category: 'physics',
    answer: false,
    ru: {
      statement: 'Стекло в старинных окнах толще снизу, потому что за века медленно стекло вниз.',
      explain: 'Миф. Стекло — твёрдое, не течёт. Неровность — от способа изготовления, стёкла ставили толстым краем вниз.',
    },
    en: {
      statement: 'Glass in old windows is thicker at the bottom because it slowly flowed down over centuries.',
      explain: "Myth. Glass is solid, it doesn't flow. The unevenness is from manufacturing — the thick edge was installed at the bottom.",
    },
  },
  {
    id: 10,
    category: 'biology',
    answer: true,
    ru: {
      statement: 'Если сложить всех муравьёв Земли, они весят примерно столько же, сколько всё человечество.',
      explain: 'Оценки биомассы муравьёв сопоставимы с человеческой — примерно один порядок величины.',
    },
    en: {
      statement: "If you added up all Earth's ants, they'd weigh about as much as all of humanity.",
      explain: 'Estimates of ant biomass are in the same order of magnitude as human biomass.',
    },
  },
  {
    id: 11,
    category: 'space',
    answer: false,
    ru: {
      statement: 'В космосе астронавты невесомы, потому что там нет гравитации.',
      explain: 'Гравитация на орбите МКС ~90% земной. Невесомость — это непрерывное свободное падение, а не её отсутствие.',
    },
    en: {
      statement: "Astronauts are weightless in space because there's no gravity there.",
      explain: "Gravity at the ISS's orbit is ~90% of Earth's. Weightlessness is continuous free fall, not the absence of gravity.",
    },
  },
  {
    id: 12,
    category: 'history',
    answer: true,
    ru: {
      statement: 'Оксфордский университет старше, чем империя ацтеков.',
      explain: 'В Оксфорде преподают с ~1096 года, столица ацтеков Теночтитлан основана ~1325. Оксфорд старше на два века.',
    },
    en: {
      statement: 'Oxford University is older than the Aztec Empire.',
      explain: 'Teaching at Oxford dates to ~1096; the Aztec capital Tenochtitlan was founded ~1325 — Oxford is two centuries older.',
    },
  },
  {
    id: 13,
    category: 'biology',
    answer: false,
    ru: {
      statement: 'Золотая рыбка помнит события лишь несколько секунд.',
      explain: 'Миф. Память золотых рыбок — недели и месяцы, их обучают трюкам и распознаванию.',
    },
    en: {
      statement: 'A goldfish only remembers things for a few seconds.',
      explain: 'Myth. Goldfish memory lasts weeks to months — they can be trained to do tricks and recognize things.',
    },
  },
  {
    id: 14,
    category: 'space',
    answer: true,
    ru: {
      statement: 'Венера в среднем горячее Меркурия, хотя дальше от Солнца.',
      explain: 'Плотная CO₂-атмосфера Венеры даёт парниковый эффект ~465°C; на Меркурии максимум ниже и тепло не удерживается.',
    },
    en: {
      statement: "Venus is on average hotter than Mercury, even though it's farther from the Sun.",
      explain: "Venus's thick CO₂ atmosphere creates a ~465°C greenhouse effect; Mercury's peak is lower and it can't retain heat.",
    },
  },
  {
    id: 15,
    category: 'physics',
    answer: false,
    ru: {
      statement: 'Расстояние, которое свет проходит за одну секунду, больше, чем от Земли до Луны.',
      explain: 'Свет за секунду ~300 000 км; до Луны ~384 000 км. Свету нужно ~1.28 секунды — чуть больше.',
    },
    en: {
      statement: 'The distance light travels in one second is farther than from Earth to the Moon.',
      explain: 'Light travels ~300,000 km/sec; the Moon is ~384,000 km away. Light needs ~1.28 seconds — a bit more.',
    },
  },
];
