import { describe, expect, it } from "vitest";
import { numbersInWords } from "./speechNumbers";

const ru = (text: string) => numbersInWords(text, "ru");
const uk = (text: string) => numbersInWords(text, "uk");

describe("numbers for the on-device voice", () => {
  it("leaves English to the voice itself", () => {
    expect(numbersInWords("Model A: 20 units at 5–35°C.", "en")).toBe("Model A: 20 units at 5–35°C.");
  });

  it("says a count with its unit in the form the number calls for", () => {
    expect(ru("1 кг, 2 кг, 5 кг, 11 кг, 21 кг")).toBe("один килограмм, два килограмма, пять килограммов, одиннадцать килограммов, двадцать один килограмм");
    expect(uk("53 кг, 2 хв, 5 год")).toBe("п'ятдесят три кілограми, дві хвилини, п'ять годин");
    expect(uk("21 % і 5 %")).toBe("двадцять один відсоток і п'ять відсотків");
  });

  it("reads the answer from the log: codes, a range and a size", () => {
    expect(ru("для ГАЗ-42 около 53 кг, а для ЗИС-13 — 80–85 кг")).toBe(
      "для ГАЗ сорок два около пятидесяти трёх килограммов, а для ЗИС тринадцать — восемьдесят — восемьдесят пять килограммов",
    );
    expect(ru("не должен превышать 70x70x70 мм")).toBe("не должен превышать семьдесят на семьдесят на семьдесят миллиметров");
    expect(ru("ГАЗ-М1 и карбюратор 11-У")).toBe("ГАЗ-М один и карбюратор одиннадцать У");
  });

  it("says decimals and large numbers", () => {
    expect(ru("1,5 кг и 0,25 л")).toBe("одна целая пять десятых килограмма и ноль целых двадцать пять сотых литра");
    expect(ru("2000 кг, 10 000 единиц, 1 250 000")).toBe("две тысячи килограммов, десять тысяч единиц, миллион двести пятьдесят тысяч");
    expect(uk("1,5 л")).toBe("одна ціла п'ять десятих літра");
  });

  it("counts feminine nouns in the feminine", () => {
    expect(ru("1 минута, 2 единицы, 2 часа")).toBe("одна минута, две единицы, два часа");
    expect(uk("1 хвилина, 2 одиниці, 2 кілограми")).toBe("одна хвилина, дві одиниці, два кілограми");
  });

  it("says signs, temperatures, times and section numbers", () => {
    expect(ru("от -5 до +40 °C")).toBe("от минус пяти до плюс сорока градусов Цельсия");
    expect(ru("±1 мм")).toBe("плюс-минус один миллиметр");
    expect(ru("в 12:05, раздел 6.2")).toBe("в двенадцать ноль пять, раздел шесть точка два");
  });

  it("puts a number and its unit in the case a preposition calls for", () => {
    expect(ru("около 53 кг на 100 км")).toBe("около пятидесяти трёх килограммов на сто километров");
    expect(ru("от 80 до 85 кг")).toBe("от восьмидесяти до восьмидесяти пяти килограммов");
    expect(ru("до 80-85 кг")).toBe("до восьмидесяти — восьмидесяти пяти килограммов");
    expect(ru("при 20 °C")).toBe("при двадцати градусах Цельсия");
    expect(ru("до 1 кг, за 1 мин")).toBe("до одного килограмма, за одну минуту");
    expect(ru("до 21 минуты")).toBe("до двадцати одной минуты");
    expect(ru("более 1,5 кг")).toBe("более одной целой пяти десятых килограмма");
    expect(ru("до 2000 кг")).toBe("до двух тысяч килограммов");
    expect(ru("к 300 кВт")).toBe("к трёмстам киловаттам");
    expect(ru("не более 70x70x70 мм")).toBe("не более семидесяти на семьдесят на семьдесят миллиметров");
    expect(ru("≤ 5 мм")).toBe("не более пяти миллиметров");
    expect(uk("до 53 кг")).toBe("до п'ятдесяти трьох кілограмів");
    expect(uk("від 5 до 35 °C")).toBe("від п'яти до тридцяти п'яти градусів Цельсія");
    expect(uk("при 20 °C")).toBe("при двадцяти градусах Цельсія");
    expect(uk("за 1 хв, до 2000 кг")).toBe("за одну хвилину, до двох тисяч кілограмів");
  });

  it("tells counting from apart from counting with", () => {
    expect(ru("с 5 до 10 мин")).toBe("с пяти до десяти минут");
    expect(ru("с 2 деталями")).toBe("с двумя деталями");
    expect(uk("з 5 до 10 хв")).toBe("з п'яти до десяти хвилин");
    expect(uk("з 5 деталями")).toBe("з п'ятьма деталями");
  });

  it("leaves a code, a year and a number after в or по in the nominative", () => {
    expect(ru("для 11-У")).toBe("для одиннадцать У");
    expect(ru("до 2005 года")).toBe("до две тысячи пять года");
    expect(ru("в 5 раз, по 2 штуки")).toBe("в пять раз, по две штуки");
  });

  it("names a lone Latin capital and leaves an ordinal and a unit-like word alone", () => {
    expect(ru("модель B, 1-й этап")).toBe("модель би, 1-й этап");
    expect(uk("модель B")).toBe("модель бі");
    expect(ru("5 лет и 3 т.д.")).toBe("пять лет и три т.д.");
  });
});
