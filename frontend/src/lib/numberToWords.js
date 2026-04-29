// Indian-system number to words converter.
// Used to convert Total GST and Bill Amount into words for the printed invoice.

const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function below100(n) {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

function below1000(n) {
  if (n < 100) return below100(n);
  return (
    ones[Math.floor(n / 100)] +
    " Hundred" +
    (n % 100 ? " " + below100(n % 100) : "")
  );
}

function inWordsIndian(n) {
  if (n === 0) return "Zero";
  let str = "";
  const crore = Math.floor(n / 10000000);
  n = n % 10000000;
  const lakh = Math.floor(n / 100000);
  n = n % 100000;
  const thousand = Math.floor(n / 1000);
  n = n % 1000;
  const rest = n;
  if (crore) str += inWordsIndian(crore) + " Crore ";
  if (lakh) str += below100(lakh) + " Lakh ";
  if (thousand) str += below100(thousand) + " Thousand ";
  if (rest) str += below1000(rest);
  return str.trim();
}

export function rupeesToWords(num) {
  if (num === null || num === undefined || isNaN(num)) return "";
  const n = Math.max(0, Number(num));
  const intPart = Math.floor(n);
  const paisa = Math.round((n - intPart) * 100);
  let result = "Rupees " + (intPart === 0 ? "Zero" : inWordsIndian(intPart));
  if (paisa > 0) {
    result += " and " + below100(paisa) + " Paisa";
  }
  return result + " Only";
}

export function fmt(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return "";
  return Number(num).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
