const CATEGORY_NAMES = {
  biology: { ru: 'Биология', en: 'Biology' },
  space: { ru: 'Космос', en: 'Space' },
  history: { ru: 'История', en: 'History' },
  botany: { ru: 'Ботаника', en: 'Botany' },
  physics: { ru: 'Физика', en: 'Physics' },
};

const I18N = {
  ru: {
    brand: 'Калибровка',
    coverSubtitle: 'Здесь выигрывает честность с собой, а не эрудиция.',
    warmupLabel: 'Разминка',
    warmupHint: 'Двигай ползунок — насколько ты в этом уверен?',
    startBtn: 'Начать',

    falseLabel: 'миф',
    trueLabel: 'правда',
    notSure: 'не знаю',

    lockBtn: 'Дальше',
    finishBtn: 'Итог',

    // per-fact reveal (warm-up + certificate)
    badgeTrue: 'ПРАВДА',
    badgeFalse: 'МИФ',
    youAbstained: 'Ты выбрал «не знаю».',
    youResult: (dir, conf, correct) =>
      `Ты склонялся к «${dir}» на ${conf}% — и ${correct ? 'был прав' : 'ошибся'}.`,

    // result screen
    resultKicker: 'Готово',
    calibrationWord: 'Твоя калибровка',
    scoreExplain:
      'Это не сколько ты знаешь, а насколько твоя уверенность совпадает с правдой. 50% — как подбросить монетку. 100% — ты уверен ровно тогда, когда прав.',
    accuracyLine: (n, total) => `Угадал по сути: ${n} из ${total}`,
    profileLabel: 'Кто ты по итогу',
    reliabilityTitle: 'Когда ты говорил «уверен» — часто ли был прав?',
    reliabilityRow: (lo, hi, real) => `На ${lo}–${hi}% уверенности — прав в ${real}%`,
    factsTitle: 'Разбор: где была правда, а где миф',
    shareBtn: 'Поделиться',
    shareCopied: 'Скопировано',
    restartBtn: 'Ещё раз',
    shareText: (score, archetype) =>
      `Моя калибровка: ${score}%. По итогу я — «${archetype}». А ты честен с собой? Проверь.`,

    archetypes: {
      calibrated: { title: 'Идеально откалиброван', desc: 'Твоя уверенность совпадает с реальностью. Редкий и ценный навык — большинство так не умеет.' },
      overconfident: { title: 'Самоуверенный эрудит', desc: 'Знаешь много, но ставишь выше, чем стоило бы. Интуиция обгоняет доказательства.' },
      underconfidentSharp: { title: 'Скромный интуит', desc: 'Ты чаще прав, чем сам думаешь. Стоит доверять себе чуть больше.' },
      underconfidentCautious: { title: 'Мудрый осторожный', desc: 'Редко уверен, но когда уверен — почти всегда прав. Не боишься сказать «не знаю».' },
    },
  },
  en: {
    brand: 'Calibration',
    coverSubtitle: 'Here, honesty with yourself beats knowing the answer.',
    warmupLabel: 'Warm-up',
    warmupHint: 'Drag the slider — how sure are you?',
    startBtn: 'Start',

    falseLabel: 'myth',
    trueLabel: 'true',
    notSure: 'no idea',

    lockBtn: 'Next',
    finishBtn: 'Result',

    badgeTrue: 'TRUE',
    badgeFalse: 'MYTH',
    youAbstained: 'You chose "no idea".',
    youResult: (dir, conf, correct) =>
      `You leaned "${dir}" at ${conf}% — and ${correct ? 'got it right' : 'missed'}.`,

    resultKicker: 'Done',
    calibrationWord: 'Your calibration',
    scoreExplain:
      "It's not how much you know, but how well your confidence matches the truth. 50% is a coin flip. 100% means you're sure exactly when you're right.",
    accuracyLine: (n, total) => `Got the gist right: ${n} of ${total}`,
    profileLabel: 'What you turned out to be',
    reliabilityTitle: 'When you said "sure" — were you actually right?',
    reliabilityRow: (lo, hi, real) => `At ${lo}–${hi}% confidence — right ${real}%`,
    factsTitle: 'The reveal: what was true, what was a myth',
    shareBtn: 'Share',
    shareCopied: 'Copied',
    restartBtn: 'Again',
    shareText: (score, archetype) =>
      `My calibration: ${score}%. Turns out I'm a "${archetype}". Are you honest with yourself? Find out.`,

    archetypes: {
      calibrated: { title: 'Perfectly Calibrated', desc: 'Your confidence matches reality. A rare and valuable skill — most people can\'t do it.' },
      overconfident: { title: 'Overconfident Know-It-All', desc: 'You know a lot, but bet higher than you should. Intuition outruns the evidence.' },
      underconfidentSharp: { title: 'Modest Intuitive', desc: "You're right more often than you think. Trust yourself a little more." },
      underconfidentCautious: { title: 'Wise & Cautious', desc: "Rarely sure, but when you are, you're almost always right. Not afraid to say \"no idea\"." },
    },
  },
};

function t(lang, key) {
  return I18N[lang][key];
}
