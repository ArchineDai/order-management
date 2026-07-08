import * as XLSX from "xlsx";
import { CsvOrderImportOptions, parseOrdersFromCsvText } from "../domain/orderImport";
import { NewOrderInput } from "../domain/orderBuilders";

export type ImportedOrderFileEncoding = "text" | "base64";

export interface ImportedOrderFile {
  name: string;
  content: string;
  encoding: ImportedOrderFileEncoding;
}

export function parseOrdersFromImportedFile(
  file: ImportedOrderFile,
  options: CsvOrderImportOptions = {}
): NewOrderInput[] {
  if (isExcelFile(file.name)) {
    return parseOrdersFromExcelBase64(file.content, options);
  }

  return parseOrdersFromCsvText(file.content, options);
}

function parseOrdersFromExcelBase64(base64: string, options: CsvOrderImportOptions): NewOrderInput[] {
  const workbook = XLSX.read(base64, { type: "base64" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  return parseOrdersFromCsvText(csv, options);
}

function isExcelFile(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name.trim());
}
