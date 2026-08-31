import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "earthquake",
    title: "中国地震台",
    type: "地震速报",
    link: "https://www.earthquake.ac.cn/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface EarthquakeItem {
  id: number;
  title: string;
  url: string;
  uploadTime: string;
}

interface EarthquakeResponse {
  records?: EarthquakeItem[];
  total?: number;
}

const getList = async (noCache: boolean) => {
  const url = `https://www.earthquake.ac.cn/collectserver/recommend/listPage?pageNum=1&pageSize=10`;
  const result = await get<EarthquakeResponse>({
    url,
    noCache,
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.earthquake.ac.cn/",
      Accept: "application/json, text/plain, */*",
    },
  });
  const list = result.data?.records ?? [];
  if (!list.length) {
    logger.warn("⚠️ [WARN] 中国地震台数据为空，接口结构可能已变化");
    return { ...result, data: [] };
  }
  return {
    ...result,
    data: list.map((v) => ({
      id: v.id,
      title: v.title,
      desc: undefined,
      timestamp: getTime(v.uploadTime),
      hot: undefined,
      url: v.url,
      mobileUrl: v.url,
    })),
  };
};
