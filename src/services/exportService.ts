import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { buildCsvExports } from "../domain/csv";
import { Order } from "../domain/types";

export async function exportOrdersAsCsv(orders: Order[]): Promise<string[]> {
  const bundle = buildCsvExports(orders);
  const directory = FileSystem.documentDirectory;
  if (!directory) {
    throw new Error("当前设备没有可写入的文档目录。");
  }

  const files = await Promise.all(
    Object.values(bundle).map(async (item) => {
      const uri = `${directory}${item.filename}`;
      await FileSystem.writeAsStringAsync(uri, `\uFEFF${item.content}`);
      return uri;
    })
  );

  if (files[0] && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(files[0], {
      mimeType: "text/csv",
      dialogTitle: "导出订单 CSV"
    });
  }

  return files;
}
