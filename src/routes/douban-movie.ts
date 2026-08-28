import type { RouterData } from "../types.js";
import { load } from "cheerio";
import { get } from "../utils/getData.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "douban-movie",
    title: "豆瓣电影",
    type: "新片榜",
    link: "https://movie.douban.com/chart",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

// 数据处理
const getNumbers = (text: string | undefined): number => {
  if (!text) return 0;
  const regex = /\d+/;
  const match = text.match(regex);
  if (match) {
    return Number(match[0]);
  } else {
    return 0;
  }
};

const getList = async (noCache: boolean) => {
  const url = `https://movie.douban.com/chart/`;
  const result = await get<string>({
    url,
    noCache,
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://movie.douban.com/",
    },
  });
  const $ = load(result.data);
  const listDom = $(".article tr.item");
  const listData = listDom.toArray().map((item) => {
    const dom = $(item);
    const url = dom.find("a").attr("href") || undefined;
    const scoreDom = dom.find(".rating_nums");
    // 未上映影片无评分，此时不展示 0.0
    const score = scoreDom.length > 0 ? scoreDom.text().trim() : "暂无评分";
    const title = dom.find("a").attr("title") || dom.find(".pl2 a").text().trim();
    return {
      id: getNumbers(url),
      title: `【${score}】${title}`,
      cover: dom.find("img").attr("src"),
      // 影片信息位于 .pl2 下的 p 标签，不带 pl 类名
      desc: dom.find(".pl2 p").text().trim(),
      timestamp: undefined,
      hot: getNumbers(dom.find("span.pl").text()),
      url: url || `https://movie.douban.com/subject/${getNumbers(url)}/`,
      mobileUrl: `https://m.douban.com/movie/subject/${getNumbers(url)}/`,
    };
  });
  if (!listData.length) {
    logger.warn("⚠️ [WARN] 豆瓣电影榜单数据为空，页面结构可能已变化");
  }
  return {
    ...result,
    data: listData,
  };
};
