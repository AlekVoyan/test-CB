// Numbers in words for the on-device voice. Supertonic 3 is shown reading digits, units and codes in English; in a
// Russian or Ukrainian answer it gets "ГАЗ-42", "53 кг" or "80–85" and does not say them the way a speaker of the
// language would. The answer keeps its digits on screen and in validation: only the text handed to this voice has them
// in words. Numbers are said in the nominative, so a number after a preposition is understandable rather than
// grammatical ("около пятьдесят три килограмма"); a unit after it takes the form the number calls for. Ordinals ("1-й")
// are left as they are.
import type { Language } from "../core/config";

type Gender = "m" | "f";
/** A unit's forms after 1, after 2–4, after 5–20, and after a fraction. */
type Forms = readonly [string, string, string, string];
type Unit = { forms: Forms; gender: Gender };

interface Words {
  zero: string;
  ones: Record<Gender, readonly string[]>;
  teens: readonly string[];
  tens: readonly string[];
  hundreds: readonly string[];
  /** Thousand, million, billion: their forms after 1, 2–4 and 5–20, and their gender. */
  scales: readonly { forms: readonly [string, string, string]; gender: Gender }[];
  /** "целая / целых", and the fraction's name for one, two and three decimal places. */
  whole: readonly [string, string];
  fractions: readonly (readonly [string, string])[];
  point: string;
  minus: string;
  plus: string;
  /** Between the sides of a size: "70 на 70". */
  by: string;
  symbols: Record<string, string>;
  units: Record<string, Unit>;
  /** Nouns counted in the feminine: "одна минута", "две единицы". */
  feminine: RegExp;
  /** A Latin capital on its own, by its name: "модель B". */
  letters: Record<string, string>;
}

const m = (one: string, few: string, many: string, fraction: string): Unit => ({ forms: [one, few, many, fraction], gender: "m" });
const f = (one: string, few: string, many: string, fraction: string): Unit => ({ forms: [one, few, many, fraction], gender: "f" });

const RU: Words = {
  zero: "ноль",
  ones: {
    m: ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"],
    f: ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"],
  },
  teens: ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"],
  tens: ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"],
  hundreds: ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"],
  scales: [
    { forms: ["тысяча", "тысячи", "тысяч"], gender: "f" },
    { forms: ["миллион", "миллиона", "миллионов"], gender: "m" },
    { forms: ["миллиард", "миллиарда", "миллиардов"], gender: "m" },
  ],
  whole: ["целая", "целых"],
  fractions: [
    ["десятая", "десятых"],
    ["сотая", "сотых"],
    ["тысячная", "тысячных"],
  ],
  point: "точка",
  minus: "минус",
  plus: "плюс",
  by: "на",
  symbols: { "±": "плюс-минус", "≤": "не более", "≥": "не менее", "<": "меньше", ">": "больше", "№": "номер" },
  units: {
    мг: m("миллиграмм", "миллиграмма", "миллиграммов", "миллиграмма"),
    кг: m("килограмм", "килограмма", "килограммов", "килограмма"),
    т: f("тонна", "тонны", "тонн", "тонны"),
    мм: m("миллиметр", "миллиметра", "миллиметров", "миллиметра"),
    см: m("сантиметр", "сантиметра", "сантиметров", "сантиметра"),
    м: m("метр", "метра", "метров", "метра"),
    км: m("километр", "километра", "километров", "километра"),
    "м/с": m("метр в секунду", "метра в секунду", "метров в секунду", "метра в секунду"),
    "км/ч": m("километр в час", "километра в час", "километров в час", "километра в час"),
    мл: m("миллилитр", "миллилитра", "миллилитров", "миллилитра"),
    л: m("литр", "литра", "литров", "литра"),
    ч: m("час", "часа", "часов", "часа"),
    мин: f("минута", "минуты", "минут", "минуты"),
    сек: f("секунда", "секунды", "секунд", "секунды"),
    "°C": m("градус Цельсия", "градуса Цельсия", "градусов Цельсия", "градуса Цельсия"),
    "°С": m("градус Цельсия", "градуса Цельсия", "градусов Цельсия", "градуса Цельсия"),
    "℃": m("градус Цельсия", "градуса Цельсия", "градусов Цельсия", "градуса Цельсия"),
    "°": m("градус", "градуса", "градусов", "градуса"),
    "%": m("процент", "процента", "процентов", "процента"),
    Вт: m("ватт", "ватта", "ватт", "ватта"),
    кВт: m("киловатт", "киловатта", "киловатт", "киловатта"),
    В: m("вольт", "вольта", "вольт", "вольта"),
    Гц: m("герц", "герца", "герц", "герца"),
    дБ: m("децибел", "децибела", "децибел", "децибела"),
    кПа: m("килопаскаль", "килопаскаля", "килопаскалей", "килопаскаля"),
    МПа: m("мегапаскаль", "мегапаскаля", "мегапаскалей", "мегапаскаля"),
    "об/мин": m("оборот в минуту", "оборота в минуту", "оборотов в минуту", "оборота в минуту"),
    "л.с.": f("лошадиная сила", "лошадиные силы", "лошадиных сил", "лошадиной силы"),
    шт: f("штука", "штуки", "штук", "штуки"),
  },
  feminine: /^(минут|секунд|единиц|тонн|штук|тысяч|недел|страниц|модел|детал|част|позици|ступен|скорост|верси|попытк|строк|лини|камер|машин|установк|точк|смен|батаре|лошадин|сил)/iu,
  letters: {
    A: "эй", B: "би", C: "си", D: "ди", E: "и", F: "эф", G: "джи", H: "эйч", I: "ай", J: "джей", K: "кей", L: "эл", M: "эм",
    N: "эн", O: "оу", P: "пи", Q: "кью", R: "ар", S: "эс", T: "ти", U: "ю", V: "ви", W: "дабл-ю", X: "икс", Y: "уай", Z: "зед",
  },
};

const UK: Words = {
  zero: "нуль",
  ones: {
    m: ["", "один", "два", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"],
    f: ["", "одна", "дві", "три", "чотири", "п'ять", "шість", "сім", "вісім", "дев'ять"],
  },
  teens: ["десять", "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять"],
  tens: ["", "", "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят", "дев'яносто"],
  hundreds: ["", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот", "вісімсот", "дев'ятсот"],
  scales: [
    { forms: ["тисяча", "тисячі", "тисяч"], gender: "f" },
    { forms: ["мільйон", "мільйони", "мільйонів"], gender: "m" },
    { forms: ["мільярд", "мільярди", "мільярдів"], gender: "m" },
  ],
  whole: ["ціла", "цілих"],
  fractions: [
    ["десята", "десятих"],
    ["сота", "сотих"],
    ["тисячна", "тисячних"],
  ],
  point: "крапка",
  minus: "мінус",
  plus: "плюс",
  by: "на",
  symbols: { "±": "плюс-мінус", "≤": "не більше", "≥": "не менше", "<": "менше", ">": "більше", "№": "номер" },
  units: {
    мг: m("міліграм", "міліграми", "міліграмів", "міліграма"),
    кг: m("кілограм", "кілограми", "кілограмів", "кілограма"),
    т: f("тонна", "тонни", "тонн", "тонни"),
    мм: m("міліметр", "міліметри", "міліметрів", "міліметра"),
    см: m("сантиметр", "сантиметри", "сантиметрів", "сантиметра"),
    м: m("метр", "метри", "метрів", "метра"),
    км: m("кілометр", "кілометри", "кілометрів", "кілометра"),
    "м/с": m("метр за секунду", "метри за секунду", "метрів за секунду", "метра за секунду"),
    "км/год": m("кілометр на годину", "кілометри на годину", "кілометрів на годину", "кілометра на годину"),
    мл: m("мілілітр", "мілілітри", "мілілітрів", "мілілітра"),
    л: m("літр", "літри", "літрів", "літра"),
    год: f("година", "години", "годин", "години"),
    хв: f("хвилина", "хвилини", "хвилин", "хвилини"),
    сек: f("секунда", "секунди", "секунд", "секунди"),
    "°C": m("градус Цельсія", "градуси Цельсія", "градусів Цельсія", "градуса Цельсія"),
    "°С": m("градус Цельсія", "градуси Цельсія", "градусів Цельсія", "градуса Цельсія"),
    "℃": m("градус Цельсія", "градуси Цельсія", "градусів Цельсія", "градуса Цельсія"),
    "°": m("градус", "градуси", "градусів", "градуса"),
    "%": m("відсоток", "відсотки", "відсотків", "відсотка"),
    Вт: m("ват", "вати", "ватів", "вата"),
    кВт: m("кіловат", "кіловати", "кіловатів", "кіловата"),
    В: m("вольт", "вольти", "вольтів", "вольта"),
    Гц: m("герц", "герци", "герців", "герца"),
    дБ: m("децибел", "децибели", "децибелів", "децибела"),
    кПа: m("кілопаскаль", "кілопаскалі", "кілопаскалів", "кілопаскаля"),
    МПа: m("мегапаскаль", "мегапаскалі", "мегапаскалів", "мегапаскаля"),
    "об/хв": m("оберт за хвилину", "оберти за хвилину", "обертів за хвилину", "оберту за хвилину"),
    "к.с.": f("кінська сила", "кінські сили", "кінських сил", "кінської сили"),
    шт: f("штука", "штуки", "штук", "штуки"),
  },
  feminine: /^(хвилин|секунд|одиниц|тонн|штук|тисяч|годин|доб|сторінк|модел|детал|частин|позиці|ступен|швидкост|версі|спроб|ліні|камер|машин|установк|точк|змін|батаре|кінськ|сил)/iu,
  letters: {
    A: "ей", B: "бі", C: "сі", D: "ді", E: "і", F: "еф", G: "джі", H: "ейч", I: "ай", J: "джей", K: "кей", L: "ел", M: "ем",
    N: "ен", O: "оу", P: "пі", Q: "к'ю", R: "ар", S: "ес", T: "ті", U: "ю", V: "ві", W: "дабл-ю", X: "ікс", Y: "вай", Z: "зед",
  },
};

const WORDS = { ru: RU, uk: UK } as const;

/** 0 after 1, 21, 101…; 1 after 2–4, 22–24…; 2 after 0, 5–20, 25–30… */
const pluralIndex = (n: number): 0 | 1 | 2 => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? 0 : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 1 : 2;
};

function belowThousand(n: number, gender: Gender, w: Words): string[] {
  const out: string[] = [];
  const rest = n % 100;
  if (n >= 100) out.push(w.hundreds[Math.floor(n / 100)]!);
  if (rest >= 10 && rest < 20) out.push(w.teens[rest - 10]!);
  else {
    if (rest >= 20) out.push(w.tens[Math.floor(rest / 10)]!);
    if (rest % 10) out.push(w.ones[gender][rest % 10]!);
  }
  return out;
}

function integerWords(n: number, gender: Gender, w: Words): string {
  if (n === 0) return w.zero;
  const out: string[] = [];
  for (let i = w.scales.length; i >= 1; i--) {
    const group = Math.floor(n / 1000 ** i) % 1000;
    if (!group) continue;
    const scale = w.scales[i - 1]!;
    // "тысяча", not "одна тысяча"
    if (group === 1) out.push(scale.forms[0]);
    else out.push(...belowThousand(group, scale.gender, w), scale.forms[pluralIndex(group)]);
  }
  out.push(...belowThousand(n % 1000, gender, w));
  return out.join(" ");
}

/** A code-like number ("05", a long serial) is read digit by digit. */
const byDigit = (digits: string) => digits.length > 12 || (digits.length > 1 && digits.startsWith("0"));
const digitWords = (digits: string, w: Words) => [...digits].map((d) => (d === "0" ? w.zero : w.ones.m[Number(d)])).join(" ");

/** One number in words, and which form of a unit follows it (3: the form after a fraction). */
function numberWords(token: string, gender: Gender, decimalPoint: boolean, w: Words): { words: string; form: 0 | 1 | 2 | 3 } {
  const plain = token.replace(/[\s  ]/g, "");
  const [int = "", frac] = plain.split(/[.,]/);
  const whole = (digits: string, g: Gender) => (byDigit(digits) ? digitWords(digits, w) : integerWords(Number(digits), g, w));
  if (frac === undefined) return { words: whole(int, gender), form: byDigit(int) ? 2 : pluralIndex(Number(int)) };
  // A comma is a decimal comma. A point is one only before a unit; "6.2" alone is more likely a section number.
  if ((plain.includes(",") || decimalPoint) && frac.length <= 3 && int.length <= 12) {
    const i = Number(int);
    const n = Number(frac);
    const words = [integerWords(i, "f", w), w.whole[pluralIndex(i) === 0 ? 0 : 1], integerWords(n, "f", w), w.fractions[frac.length - 1]![pluralIndex(n) === 0 ? 0 : 1]];
    return { words: words.join(" "), form: 3 };
  }
  return { words: `${whole(int, "m")} ${w.point} ${whole(frac, "m")}`, form: 2 };
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
    .replace(expression(w), (match: string, unit: string | undefined, offset: number, source: string) => {
      const body = unit ? match.slice(0, match.length - unit.length) : match;
      const next = source.slice(offset + match.length).match(/^\s*(\p{L}+)/u)?.[1];
      const gender: Gender = unit ? w.units[unit]!.gender : next && w.feminine.test(next) ? "f" : "m";
      let said = "";
      let form: 0 | 1 | 2 | 3 = 2;
      let end = 0;
      for (const n of body.matchAll(new RegExp(NUMBER, "g"))) {
        if (said) said += body.slice(end, n.index).trim() === "-" ? " — " : ` ${w.by} `;
        const spoken = numberWords(n[0], gender, !!unit, w);
        said += spoken.words;
        form = spoken.form;
        end = n.index! + n[0].length;
      }
      return unit ? `${said} ${w.units[unit]!.forms[form]}` : said;
    })
    .replace(/(?<![\p{L}\d'])[A-Z](?![\p{L}\d'])/gu, (letter) => w.letters[letter]!);
  return t.replace(/ {2,}/g, " ").trim();
}
