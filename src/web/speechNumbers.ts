// Numbers in words for the on-device voice. Supertonic 3 is shown reading digits, units and codes in English; in a
// Russian or Ukrainian answer it gets "ГАЗ-42", "53 кг" or "80–85" and does not say them the way a speaker of the
// language would. The answer keeps its digits on screen and in validation: only the text handed to this voice has them
// in words. After a preposition the number and its unit take the case the preposition calls for ("около пятидесяти
// трёх килограммов"); after "в" and "по", whose case depends on the meaning, they stay in the nominative, and so do
// years and codes. Ordinals ("1-й") are left as they are.
import type { Language } from "../core/config";

type Gender = "m" | "f";
/** Nominative, genitive, dative, instrumental, prepositional (locative in Ukrainian), accusative. */
type Case = 0 | 1 | 2 | 3 | 4 | 5;
const NOM = 0;
const GEN = 1;
const DAT = 2;
const INS = 3;
const PREP = 4;
const ACC = 5;

/** A numeral in the six cases, in the order above. */
type Cases = readonly [string, string, string, string, string, string];

/**
 * A counted noun: its nominative after 1, after 2–4 and after 5–20; its singular in the genitive, dative, instrumental,
 * prepositional and accusative; its plural in the first four of those. The singular genitive also follows a fraction.
 */
interface Noun {
  one: string;
  few: string;
  many: string;
  sg: readonly [string, string, string, string, string];
  pl: readonly [string, string, string, string];
  gender: Gender;
}

interface Words {
  zero: Cases;
  ones: Record<Gender, readonly Cases[]>;
  teens: readonly Cases[];
  tens: readonly Cases[];
  hundreds: readonly Cases[];
  /** Thousand, million, billion. */
  scales: readonly Noun[];
  /** "целая", and the fraction's name for one, two and three decimal places. */
  whole: Noun;
  fractions: readonly Noun[];
  point: string;
  minus: string;
  plus: string;
  /** Between the sides of a size: "70 на 70". */
  by: string;
  symbols: Record<string, string>;
  units: Record<string, Noun>;
  /** The case each preposition puts a number in. */
  prepositions: Record<string, Case>;
  /** "с" / "з": from (genitive) when "до" follows, with (instrumental) otherwise. */
  fromOrWith: readonly string[];
  /** A year is an ordinal; it is left in the nominative rather than declined as a count. */
  year: RegExp;
  /** Nouns counted in the feminine: "одна минута", "две единицы". */
  feminine: RegExp;
  /** A Latin capital on its own, by its name: "модель B". */
  letters: Record<string, string>;
}

const NONE: Cases = ["", "", "", "", "", ""];

/** A counted noun with words after it that do not change: "градус Цельсия". */
const suffixed = (noun: Noun, suffix: string): Noun => ({
  ...noun,
  one: noun.one + suffix,
  few: noun.few + suffix,
  many: noun.many + suffix,
  sg: noun.sg.map((s) => s + suffix) as unknown as Noun["sg"],
  pl: noun.pl.map((s) => s + suffix) as unknown as Noun["pl"],
});

// ---------- Russian ----------

/** "килограмм": -а, -у, -ом, -е; plural -ов (or as given), -ам, -ами, -ах. */
const ruHard = (nom: string, genPl = `${nom}ов`): Noun => ({
  one: nom,
  few: `${nom}а`,
  many: genPl,
  sg: [`${nom}а`, `${nom}у`, `${nom}ом`, `${nom}е`, nom],
  pl: [genPl, `${nom}ам`, `${nom}ами`, `${nom}ах`],
  gender: "m",
});
/** "килопаскаль": -я, -ю, -ем, -е; plural -ей, -ям, -ями, -ях. */
const ruSoft = (stem: string): Noun => ({
  one: `${stem}ь`,
  few: `${stem}я`,
  many: `${stem}ей`,
  sg: [`${stem}я`, `${stem}ю`, `${stem}ем`, `${stem}е`, `${stem}ь`],
  pl: [`${stem}ей`, `${stem}ям`, `${stem}ями`, `${stem}ях`],
  gender: "m",
});
/** "минута": -ы (or -и), -е, -ой, -е, -у; plural bare stem, -ам, -ами, -ах. */
const ruFem = (stem: string, genSg = "ы"): Noun => ({
  one: `${stem}а`,
  few: `${stem}${genSg}`,
  many: stem,
  sg: [`${stem}${genSg}`, `${stem}е`, `${stem}ой`, `${stem}е`, `${stem}у`],
  pl: [stem, `${stem}ам`, `${stem}ами`, `${stem}ах`],
  gender: "f",
});
/** "целая", "десятая": declined as a feminine adjective. */
const ruAdj = (stem: string): Noun => ({
  one: `${stem}ая`,
  few: `${stem}ых`,
  many: `${stem}ых`,
  sg: [`${stem}ой`, `${stem}ой`, `${stem}ой`, `${stem}ой`, `${stem}ую`],
  pl: [`${stem}ых`, `${stem}ым`, `${stem}ыми`, `${stem}ых`],
  gender: "f",
});
/** "пять", "десять", "двадцать": -и in the genitive, dative and prepositional, -ю in the instrumental. */
const ruSoftNumeral = (nom: string): Cases => {
  const stem = nom.slice(0, -1);
  return [nom, `${stem}и`, `${stem}и`, `${nom}ю`, `${stem}и`, nom];
};

const RU_ONES: Cases[] = [
  NONE,
  ["один", "одного", "одному", "одним", "одном", "один"],
  ["два", "двух", "двум", "двумя", "двух", "два"],
  ["три", "трёх", "трём", "тремя", "трёх", "три"],
  ["четыре", "четырёх", "четырём", "четырьмя", "четырёх", "четыре"],
  ruSoftNumeral("пять"),
  ruSoftNumeral("шесть"),
  ruSoftNumeral("семь"),
  ["восемь", "восьми", "восьми", "восемью", "восьми", "восемь"],
  ruSoftNumeral("девять"),
];
const RU_CELSIUS = suffixed(ruHard("градус"), " Цельсия");

const RU: Words = {
  zero: ["ноль", "нуля", "нулю", "нулём", "нуле", "ноль"],
  ones: {
    m: RU_ONES,
    f: [NONE, ["одна", "одной", "одной", "одной", "одной", "одну"], ["две", "двух", "двум", "двумя", "двух", "две"], ...RU_ONES.slice(3)],
  },
  teens: ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"].map(ruSoftNumeral),
  tens: [
    NONE,
    NONE,
    ruSoftNumeral("двадцать"),
    ruSoftNumeral("тридцать"),
    ["сорок", "сорока", "сорока", "сорока", "сорока", "сорок"],
    ["пятьдесят", "пятидесяти", "пятидесяти", "пятьюдесятью", "пятидесяти", "пятьдесят"],
    ["шестьдесят", "шестидесяти", "шестидесяти", "шестьюдесятью", "шестидесяти", "шестьдесят"],
    ["семьдесят", "семидесяти", "семидесяти", "семьюдесятью", "семидесяти", "семьдесят"],
    ["восемьдесят", "восьмидесяти", "восьмидесяти", "восемьюдесятью", "восьмидесяти", "восемьдесят"],
    ["девяносто", "девяноста", "девяноста", "девяноста", "девяноста", "девяносто"],
  ],
  hundreds: [
    NONE,
    ["сто", "ста", "ста", "ста", "ста", "сто"],
    ["двести", "двухсот", "двумстам", "двумястами", "двухстах", "двести"],
    ["триста", "трёхсот", "трёмстам", "тремястами", "трёхстах", "триста"],
    ["четыреста", "четырёхсот", "четырёмстам", "четырьмястами", "четырёхстах", "четыреста"],
    ["пятьсот", "пятисот", "пятистам", "пятьюстами", "пятистах", "пятьсот"],
    ["шестьсот", "шестисот", "шестистам", "шестьюстами", "шестистах", "шестьсот"],
    ["семьсот", "семисот", "семистам", "семьюстами", "семистах", "семьсот"],
    ["восемьсот", "восьмисот", "восьмистам", "восемьюстами", "восьмистах", "восемьсот"],
    ["девятьсот", "девятисот", "девятистам", "девятьюстами", "девятистах", "девятьсот"],
  ],
  scales: [{ ...ruFem("тысяч", "и"), sg: ["тысячи", "тысяче", "тысячей", "тысяче", "тысячу"] }, ruHard("миллион"), ruHard("миллиард")],
  whole: ruAdj("цел"),
  fractions: [ruAdj("десят"), ruAdj("сот"), ruAdj("тысячн")],
  point: "точка",
  minus: "минус",
  plus: "плюс",
  by: "на",
  symbols: { "±": "плюс-минус", "≤": "не более", "≥": "не менее", "<": "меньше", ">": "больше", "№": "номер" },
  units: {
    мг: ruHard("миллиграмм"),
    кг: ruHard("килограмм"),
    т: ruFem("тонн"),
    мм: ruHard("миллиметр"),
    см: ruHard("сантиметр"),
    м: ruHard("метр"),
    км: ruHard("километр"),
    "м/с": suffixed(ruHard("метр"), " в секунду"),
    "км/ч": suffixed(ruHard("километр"), " в час"),
    мл: ruHard("миллилитр"),
    л: ruHard("литр"),
    ч: ruHard("час"),
    мин: ruFem("минут"),
    сек: ruFem("секунд"),
    "°C": RU_CELSIUS,
    "°С": RU_CELSIUS,
    "℃": RU_CELSIUS,
    "°": ruHard("градус"),
    "%": ruHard("процент"),
    Вт: ruHard("ватт", "ватт"),
    кВт: ruHard("киловатт", "киловатт"),
    В: ruHard("вольт", "вольт"),
    Гц: ruHard("герц", "герц"),
    дБ: ruHard("децибел", "децибел"),
    кПа: ruSoft("килопаскал"),
    МПа: ruSoft("мегапаскал"),
    "об/мин": suffixed(ruHard("оборот"), " в минуту"),
    "л.с.": {
      one: "лошадиная сила",
      few: "лошадиные силы",
      many: "лошадиных сил",
      sg: ["лошадиной силы", "лошадиной силе", "лошадиной силой", "лошадиной силе", "лошадиную силу"],
      pl: ["лошадиных сил", "лошадиным силам", "лошадиными силами", "лошадиных силах"],
      gender: "f",
    },
    шт: ruFem("штук", "и"),
  },
  prepositions: {
    до: GEN, от: GEN, около: GEN, более: GEN, менее: GEN, больше: GEN, меньше: GEN, свыше: GEN, выше: GEN, ниже: GEN,
    после: GEN, без: GEN, из: GEN, "из-за": GEN, для: GEN, кроме: GEN, у: GEN, вокруг: GEN, против: GEN, среди: GEN,
    возле: GEN, вместо: GEN, порядка: GEN,
    к: DAT, ко: DAT, согласно: DAT, благодаря: DAT,
    между: INS, над: INS, под: INS, перед: INS,
    при: PREP, о: PREP, об: PREP,
    на: ACC, за: ACC, через: ACC, про: ACC, спустя: ACC,
  },
  fromOrWith: ["с", "со"],
  year: /^(год|году|года|годом|г)(?!\p{L})/iu,
  feminine: /^(минут|секунд|единиц|тонн|штук|тысяч|недел|страниц|модел|детал|част|позици|ступен|скорост|верси|попытк|строк|лини|камер|машин|установк|точк|смен|батаре|лошадин|сил)/iu,
  letters: {
    A: "эй", B: "би", C: "си", D: "ди", E: "и", F: "эф", G: "джи", H: "эйч", I: "ай", J: "джей", K: "кей", L: "эл", M: "эм",
    N: "эн", O: "оу", P: "пи", Q: "кью", R: "ар", S: "эс", T: "ти", U: "ю", V: "ви", W: "дабл-ю", X: "икс", Y: "уай", Z: "зед",
  },
};

// ---------- Ukrainian ----------

/** "кілограм": -а (or -у), -у, -ом, -і; plural -и, -ів, -ам, -ами, -ах. */
const ukHard = (nom: string, stem = nom, genSg = "а", locSg = `${stem}і`): Noun => ({
  one: nom,
  few: `${stem}и`,
  many: `${stem}ів`,
  sg: [`${stem}${genSg}`, `${stem}у`, `${stem}ом`, locSg, nom],
  pl: [`${stem}ів`, `${stem}ам`, `${stem}ами`, `${stem}ах`],
  gender: "m",
});
/** "кілопаскаль": -я, -ю, -ем, -і; plural -і, -ів, -ям, -ями, -ях. */
const ukSoft = (stem: string): Noun => ({
  one: `${stem}ь`,
  few: `${stem}і`,
  many: `${stem}ів`,
  sg: [`${stem}я`, `${stem}ю`, `${stem}ем`, `${stem}і`, `${stem}ь`],
  pl: [`${stem}ів`, `${stem}ям`, `${stem}ями`, `${stem}ях`],
  gender: "m",
});
/** "хвилина": -и, -і, -ою, -і, -у; plural bare stem, -ам, -ами, -ах. "штука" softens to "штуці". */
const ukFem = (stem: string, softStem = stem): Noun => ({
  one: `${stem}а`,
  few: `${stem}и`,
  many: stem,
  sg: [`${stem}и`, `${softStem}і`, `${stem}ою`, `${softStem}і`, `${stem}у`],
  pl: [stem, `${stem}ам`, `${stem}ами`, `${stem}ах`],
  gender: "f",
});
/** "ціла", "десята": declined as a feminine adjective. */
const ukAdj = (stem: string): Noun => ({
  one: `${stem}а`,
  few: `${stem}их`,
  many: `${stem}их`,
  sg: [`${stem}ої`, `${stem}ій`, `${stem}ою`, `${stem}ій`, `${stem}у`],
  pl: [`${stem}их`, `${stem}им`, `${stem}ими`, `${stem}их`],
  gender: "f",
});
/** "п'ять", "десять", "двадцять": -и in the genitive, dative and locative, -ма in the instrumental. */
const ukSoftNumeral = (nom: string): Cases => {
  const stem = nom.slice(0, -1);
  return [nom, `${stem}и`, `${stem}и`, `${nom}ма`, `${stem}и`, nom];
};

const UK_ONES: Cases[] = [
  NONE,
  ["один", "одного", "одному", "одним", "одному", "один"],
  ["два", "двох", "двом", "двома", "двох", "два"],
  ["три", "трьох", "трьом", "трьома", "трьох", "три"],
  ["чотири", "чотирьох", "чотирьом", "чотирма", "чотирьох", "чотири"],
  ukSoftNumeral("п'ять"),
  ["шість", "шести", "шести", "шістьма", "шести", "шість"],
  ["сім", "семи", "семи", "сьома", "семи", "сім"],
  ["вісім", "восьми", "восьми", "вісьма", "восьми", "вісім"],
  ukSoftNumeral("дев'ять"),
];
const UK_CELSIUS = suffixed(ukHard("градус"), " Цельсія");

const UK: Words = {
  zero: ["нуль", "нуля", "нулю", "нулем", "нулі", "нуль"],
  ones: {
    m: UK_ONES,
    f: [NONE, ["одна", "однієї", "одній", "однією", "одній", "одну"], ["дві", "двох", "двом", "двома", "двох", "дві"], ...UK_ONES.slice(3)],
  },
  teens: ["десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять"].map(ukSoftNumeral),
  tens: [
    NONE,
    NONE,
    ukSoftNumeral("двадцять"),
    ukSoftNumeral("тридцять"),
    ["сорок", "сорока", "сорока", "сорока", "сорока", "сорок"],
    ["п'ятдесят", "п'ятдесяти", "п'ятдесяти", "п'ятдесятьма", "п'ятдесяти", "п'ятдесят"],
    ["шістдесят", "шістдесяти", "шістдесяти", "шістдесятьма", "шістдесяти", "шістдесят"],
    ["сімдесят", "сімдесяти", "сімдесяти", "сімдесятьма", "сімдесяти", "сімдесят"],
    ["вісімдесят", "вісімдесяти", "вісімдесяти", "вісімдесятьма", "вісімдесяти", "вісімдесят"],
    ["дев'яносто", "дев'яноста", "дев'яноста", "дев'яноста", "дев'яноста", "дев'яносто"],
  ],
  hundreds: [
    NONE,
    ["сто", "ста", "ста", "ста", "ста", "сто"],
    ["двісті", "двохсот", "двомстам", "двомастами", "двохстах", "двісті"],
    ["триста", "трьохсот", "трьомстам", "трьомастами", "трьохстах", "триста"],
    ["чотириста", "чотирьохсот", "чотирьомстам", "чотирмастами", "чотирьохстах", "чотириста"],
    ["п'ятсот", "п'ятисот", "п'ятистам", "п'ятьмастами", "п'ятистах", "п'ятсот"],
    ["шістсот", "шестисот", "шестистам", "шістьмастами", "шестистах", "шістсот"],
    ["сімсот", "семисот", "семистам", "сьомастами", "семистах", "сімсот"],
    ["вісімсот", "восьмисот", "восьмистам", "вісьмастами", "восьмистах", "вісімсот"],
    ["дев'ятсот", "дев'ятисот", "дев'ятистам", "дев'ятьмастами", "дев'ятистах", "дев'ятсот"],
  ],
  scales: [
    {
      one: "тисяча",
      few: "тисячі",
      many: "тисяч",
      sg: ["тисячі", "тисячі", "тисячею", "тисячі", "тисячу"],
      pl: ["тисяч", "тисячам", "тисячами", "тисячах"],
      gender: "f",
    },
    ukHard("мільйон"),
    ukHard("мільярд"),
  ],
  whole: ukAdj("ціл"),
  fractions: [ukAdj("десят"), ukAdj("сот"), ukAdj("тисячн")],
  point: "крапка",
  minus: "мінус",
  plus: "плюс",
  by: "на",
  symbols: { "±": "плюс-мінус", "≤": "не більше", "≥": "не менше", "<": "менше", ">": "більше", "№": "номер" },
  units: {
    мг: ukHard("міліграм"),
    кг: ukHard("кілограм"),
    т: ukFem("тонн"),
    мм: ukHard("міліметр"),
    см: ukHard("сантиметр"),
    м: ukHard("метр"),
    км: ukHard("кілометр"),
    "м/с": suffixed(ukHard("метр"), " за секунду"),
    "км/год": suffixed(ukHard("кілометр"), " на годину"),
    мл: ukHard("мілілітр"),
    л: ukHard("літр"),
    год: ukFem("годин"),
    хв: ukFem("хвилин"),
    сек: ukFem("секунд"),
    "°C": UK_CELSIUS,
    "°С": UK_CELSIUS,
    "℃": UK_CELSIUS,
    "°": ukHard("градус"),
    "%": ukHard("відсоток", "відсотк", "а", "відсотку"),
    Вт: ukHard("ват"),
    кВт: ukHard("кіловат"),
    В: ukHard("вольт"),
    Гц: ukHard("герц"),
    дБ: ukHard("децибел"),
    кПа: ukSoft("кілопаскал"),
    МПа: ukSoft("мегапаскал"),
    "об/хв": suffixed(ukHard("оберт", "оберт", "у"), " за хвилину"),
    "к.с.": {
      one: "кінська сила",
      few: "кінські сили",
      many: "кінських сил",
      sg: ["кінської сили", "кінській силі", "кінською силою", "кінській силі", "кінську силу"],
      pl: ["кінських сил", "кінським силам", "кінськими силами", "кінських силах"],
      gender: "f",
    },
    шт: ukFem("штук", "штуц"),
  },
  prepositions: {
    до: GEN, від: GEN, біля: GEN, близько: GEN, більше: GEN, менше: GEN, вище: GEN, нижче: GEN, після: GEN, без: GEN,
    для: GEN, крім: GEN, окрім: GEN, серед: GEN, замість: GEN, "з-за": GEN, "із-за": GEN,
    завдяки: DAT,
    між: INS, над: INS, під: INS, перед: INS,
    при: PREP,
    на: ACC, за: ACC, через: ACC, про: ACC,
  },
  fromOrWith: ["з", "із", "зі"],
  year: /^(рік|року|році|роком|р)(?!\p{L})/iu,
  feminine: /^(хвилин|секунд|одиниц|тонн|штук|тисяч|годин|доб|сторінк|модел|детал|частин|позиці|ступен|швидкост|версі|спроб|ліні|камер|машин|установк|точк|змін|батаре|кінськ|сил)/iu,
  letters: {
    A: "ей", B: "бі", C: "сі", D: "ді", E: "і", F: "еф", G: "джі", H: "ейч", I: "ай", J: "джей", K: "кей", L: "ел", M: "ем",
    N: "ен", O: "оу", P: "пі", Q: "к'ю", R: "ар", S: "ес", T: "ті", U: "ю", V: "ві", W: "дабл-ю", X: "ікс", Y: "вай", Z: "зед",
  },
};

const WORDS = { ru: RU, uk: UK } as const;

// ---------- numbers ----------

/** 0 after 1, 21, 101…; 1 after 2–4, 22–24…; 2 after 0, 5–20, 25–30… */
const pluralIndex = (n: number): 0 | 1 | 2 => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? 0 : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 1 : 2;
};

/** The form of a noun after the number n in the case c: "два килограмма", "двух килограммов", "одну минуту". */
function nounForm(noun: Noun, c: Case, n: number): string {
  const i = pluralIndex(n);
  if (c === NOM || (c === ACC && i > 0)) return [noun.one, noun.few, noun.many][i]!;
  if (c === ACC) return noun.sg[4];
  return i === 0 ? noun.sg[c - 1]! : noun.pl[c - 1]!;
}

function belowThousand(n: number, gender: Gender, c: Case, w: Words): string[] {
  const out: string[] = [];
  const rest = n % 100;
  if (n >= 100) out.push(w.hundreds[Math.floor(n / 100)]![c]);
  if (rest >= 10 && rest < 20) out.push(w.teens[rest - 10]![c]);
  else {
    if (rest >= 20) out.push(w.tens[Math.floor(rest / 10)]![c]);
    if (rest % 10) out.push(w.ones[gender][rest % 10]![c]);
  }
  return out;
}

function integerWords(n: number, gender: Gender, c: Case, w: Words): string {
  if (n === 0) return w.zero[c];
  const out: string[] = [];
  for (let i = w.scales.length; i >= 1; i--) {
    const group = Math.floor(n / 1000 ** i) % 1000;
    if (!group) continue;
    const scale = w.scales[i - 1]!;
    // "тысяча", not "одна тысяча"
    if (group === 1) out.push(nounForm(scale, c, 1));
    else out.push(...belowThousand(group, scale.gender, c, w), nounForm(scale, c, group));
  }
  out.push(...belowThousand(n % 1000, gender, c, w));
  return out.join(" ");
}

/** A code-like number ("05", a long serial) is read digit by digit. */
const byDigit = (digits: string) => digits.length > 12 || (digits.length > 1 && digits.startsWith("0"));
const digitWords = (digits: string, w: Words) => [...digits].map((d) => (d === "0" ? w.zero[NOM] : w.ones.m[Number(d)]![NOM])).join(" ");

/** One number in words, and what a unit after it agrees with: the count, or a fraction. */
function numberWords(token: string, gender: Gender, c: Case, decimalPoint: boolean, w: Words): { words: string; count: number; fraction: boolean } {
  const plain = token.replace(/[\s  ]/g, "");
  const [int = "", frac] = plain.split(/[.,]/);
  if (frac === undefined) {
    if (byDigit(int)) return { words: digitWords(int, w), count: 5, fraction: false };
    return { words: integerWords(Number(int), gender, c, w), count: Number(int), fraction: false };
  }
  // A comma is a decimal comma. A point is one only before a unit; "6.2" alone is more likely a section number.
  if ((plain.includes(",") || decimalPoint) && frac.length <= 3 && int.length <= 12) {
    const i = Number(int);
    const n = Number(frac);
    const words = [integerWords(i, "f", c, w), nounForm(w.whole, c, i), integerWords(n, "f", c, w), nounForm(w.fractions[frac.length - 1]!, c, n)];
    return { words: words.join(" "), count: n, fraction: true };
  }
  const part = (digits: string) => (byDigit(digits) ? digitWords(digits, w) : integerWords(Number(digits), "m", NOM, w));
  return { words: `${part(int)} ${w.point} ${part(frac)}`, count: 5, fraction: false };
}

const SIGNS = "плюс-минус|плюс-мінус|минус|мінус|плюс";
const WORD_BEFORE = new RegExp(String.raw`(?<![\p{L}-])(\p{L}+(?:-\p{L}+)?)\s+(?:(?:${SIGNS})\s+)?$`, "u");

/** The case the word before a number puts it in: a preposition's, or the nominative. */
function caseFor(before: string, after: string, hasUnit: boolean, w: Words): Case {
  const word = before.match(WORD_BEFORE)?.[1]?.toLowerCase();
  if (!word) return NOM;
  // A code ("для 11-У") and a year ("до 2005 года") are names, not counts.
  if (!hasUnit && (/^\s*\p{Lu}{1,4}(?!\p{L})/u.test(after) || w.year.test(after.trimStart()))) return NOM;
  // "с 5 до 10" counts from; "с 5 деталями" counts with.
  if (w.fromOrWith.includes(word)) return /^[^.!?;]{0,24}?(?<!\p{L})(?:до|по)(?!\p{L})/u.test(after) ? GEN : INS;
  return w.prepositions[word] ?? NOM;
}

const NUMBER = String.raw`\d{1,3}(?:[   ]\d{3})+(?!\d)|\d+(?:[.,]\d+)?`;
const BETWEEN = String.raw`\s*(?:-|[xхXХ×*])\s*`;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const expressions = new Map<Words, RegExp>();
/** Numbers joined into a range or a size, then an optional unit: "80-85 кг", "70x70x70 мм", "1,5 л". */
function expression(w: Words): RegExp {
  let re = expressions.get(w);
  if (!re) {
    const units = Object.keys(w.units)
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join("|");
    re = new RegExp(String.raw`(?<![\p{L}\d])(?:${NUMBER})(?:${BETWEEN}(?:${NUMBER}))*(?!\d|[.,]\d|-\p{Ll})(?:\s*(${units})(?!\p{L}|\.\p{L}))?`, "gu");
    expressions.set(w, re);
  }
  return re;
}

/** The text for the on-device voice: numbers, units, signs and lone Latin capitals in words. English is left as it is. */
export function numbersInWords(text: string, language: Language): string {
  if (language === "en") return text;
  const w = WORDS[language];
  const t = text
    // a date or a version: its parts one after another
    .replace(/(?<![\d.])\d+(?:\.\d+){2,}(?![\d.])/g, (s) => s.split(".").join(" "))
    // a time: "12:05" → "12 05"
    .replace(/(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/g, "$1 $2")
    // an en or em dash between two numbers is a range; one with spaces around it is punctuation
    .replace(/(\d)[–—](?=\d)/g, "$1-")
    // codes: "ГАЗ-42", "ГАЗ-М1", "11-У"
    .replace(/(\p{L})-?(?=\d)/gu, "$1 ")
    .replace(/(\d)-(?=\p{Lu})/gu, "$1 ")
    .replace(/(^|[\s(])[-−](?=\d)/g, `$1${w.minus} `)
    .replace(/(^|[\s(])\+(?=\d)/g, `$1${w.plus} `)
    .replace(/[±≤≥<>№]/g, (s) => ` ${w.symbols[s]} `)
    .replace(expression(w), (match: string, unitKey: string | undefined, offset: number, source: string) => {
      const unit = unitKey ? w.units[unitKey]! : undefined;
      const body = unitKey ? match.slice(0, match.length - unitKey.length) : match;
      const after = source.slice(offset + match.length);
      const next = after.match(/^\s*(\p{L}+)/u)?.[1];
      const gender: Gender = unit ? unit.gender : next && w.feminine.test(next) ? "f" : "m";
      let c = caseFor(source.slice(0, offset), after, !!unit, w);
      let said = "";
      let last = { count: 5, fraction: false };
      let end = 0;
      for (const n of body.matchAll(new RegExp(NUMBER, "g"))) {
        if (said) {
          const range = body.slice(end, n.index).trim() === "-";
          said += range ? " — " : ` ${w.by} `;
          // "от восьмидесяти — восьмидесяти пяти"; "семидесяти на семьдесят"
          if (!range) c = ACC;
        }
        const spoken = numberWords(n[0], gender, c, !!unit, w);
        said += spoken.words;
        last = spoken;
        end = n.index! + n[0].length;
      }
      if (!unit) return said;
      return `${said} ${last.fraction ? unit.sg[0] : nounForm(unit, c, last.count)}`;
    })
    .replace(/(?<![\p{L}\d'])[A-Z](?![\p{L}\d'])/gu, (letter) => w.letters[letter]!);
  return t.replace(/ {2,}/g, " ").trim();
}
