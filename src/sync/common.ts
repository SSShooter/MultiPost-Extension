import { getAccountInfoFromPlatformInfo, getAccountInfoFromPlatformInfos } from "./account";
import { ArticleInfoMap } from "./article";
import { DynamicInfoMap } from "./dynamic";
import { getExtraConfigFromPlatformInfo, getExtraConfigFromPlatformInfos } from "./extraconfig";
import { PodcastInfoMap } from "./podcast";
import { VideoInfoMap } from "./video";

export interface RedditExtraConfig {
  selectedSubreddit?: string;
  historySubreddits?: string[];
}

// Reddit：跳转时直接打开对应 subreddit 的发布页以预选社区
export function getRedditSubmitUrl(platform: SyncDataPlatform): string {
  const config = (platform.extraConfig as RedditExtraConfig) || {};
  const subreddit = (config.selectedSubreddit || "").trim().replace(/^r\//i, "");
  return subreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/submit?type=IMAGE`
    : "https://www.reddit.com/submit?type=IMAGE";
}

export function hasRedditSubreddit(platform: SyncDataPlatform): boolean {
  const config = (platform.extraConfig as RedditExtraConfig) || {};
  const subreddit = (config.selectedSubreddit || "").trim().replace(/^r\//i, "");
  return subreddit.length > 0;
}

// LinkedIn：配置公司 ID 后以公司主页身份发布（公司管理页自带分享弹窗）
export interface LinkedinExtraConfig {
  companyId?: string;
}

// 支持直接粘贴公司管理页链接，自动提取 /company/ 后面的 ID（数字 ID 或自定义 slug 均可）
export function parseLinkedinCompanyId(input: string): string {
  const value = (input || "").trim();
  const fromUrl = value.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (fromUrl) return fromUrl[1];
  return value.replace(/^\/+|\/+$/g, "");
}

export function getLinkedinCompanyUrl(platform: SyncDataPlatform): string {
  const config = (platform.extraConfig as LinkedinExtraConfig) || {};
  const companyId = parseLinkedinCompanyId(config.companyId || "");
  return `https://www.linkedin.com/company/${encodeURIComponent(companyId)}/admin/page-posts/published/?share=true`;
}

export function hasLinkedinCompanyId(platform: SyncDataPlatform): boolean {
  const config = (platform.extraConfig as LinkedinExtraConfig) || {};
  return parseLinkedinCompanyId(config.companyId || "").length > 0;
}

export interface SyncDataPlatform {
  name: string;
  injectUrl?: string;
  extraConfig?:
    | {
        customInjectUrls?: string[]; // Beta 功能，用于自定义注入 URL
      }
    | unknown;
}

export interface SyncData {
  platforms: SyncDataPlatform[];
  isAutoPublish: boolean;
  data: DynamicData | ArticleData | VideoData | PodcastData;
  origin?: DynamicData | ArticleData | VideoData | PodcastData; // Beta 功能，用于临时存储，发布时不需要提供该字段
}

export interface DynamicData {
  title: string;
  content: string;
  images: FileData[];
  videos: FileData[];
  tags?: string[];
  scheduledPublishTime?: number;
}

export interface PodcastData {
  title: string;
  description: string;
  audio: FileData;
  cover?: FileData;
  tags?: string[];
  category?: string | number;
}

export interface FileData {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface ArticleData {
  title: string;
  digest: string;
  cover: FileData;
  htmlContent: string;
  markdownContent: string;
  images?: FileData[]; // 发布时可不提供该字段
  tags?: string[];
  category?: string | number; // 平台分类 ID 或名称
  original?: boolean; // 原创声明
  allowComment?: boolean;
  scheduledPublishTime?: number;
}

export interface VideoData {
  title: string;
  content: string;
  video: FileData;
  tags?: string[];
  cover?: FileData;
  verticalCover?: FileData;
  horizontalCover?: FileData;
  videoFile?: File; // 原始 File 对象，用于避免 blob URL 问题
  scheduledPublishTime?: number;
  category?: string | number; // 平台分区 ID（如 B 站 tid，YouTube category）
  original?: boolean; // 原创声明
  collectionId?: string | number; // 合集/系列 ID（如 B 站 list_id）
  description?: string; // 描述（独立于 content/简介）
}

export interface PlatformInfo {
  type: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST";
  name: string;
  homeUrl: string;
  faviconUrl?: string;
  iconifyIcon?: string;
  platformName: string;
  injectUrl: string;
  injectFunction: (data: SyncData) => Promise<void>;
  tags?: string[];
  accountKey: string;
  accountInfo?: AccountInfo;
  extraConfig?: unknown;
}

export interface AccountInfo {
  provider: string;
  accountId: string;
  username: string;
  description?: string;
  profileUrl?: string;
  avatarUrl?: string;
  extraData: unknown;
}

export const infoMap: Record<string, PlatformInfo> = {
  ...DynamicInfoMap,
  ...ArticleInfoMap,
  ...VideoInfoMap,
  ...PodcastInfoMap,
};

export async function getPlatformInfo(platform: string): Promise<PlatformInfo | null> {
  const platformInfo = infoMap[platform];
  if (platformInfo) {
    return await getExtraConfigFromPlatformInfo(await getAccountInfoFromPlatformInfo(platformInfo));
  }
  return null;
}

export function getRawPlatformInfo(platform: string): PlatformInfo | null {
  return infoMap[platform];
}

export async function getPlatformInfos(type?: "DYNAMIC" | "VIDEO" | "ARTICLE" | "PODCAST"): Promise<PlatformInfo[]> {
  const platformInfos: PlatformInfo[] = [];
  for (const info of Object.values(infoMap)) {
    if (type && info.type !== type) continue;
    platformInfos.push(info);
  }

  return await getExtraConfigFromPlatformInfos(await getAccountInfoFromPlatformInfos(platformInfos));
}

// Inject || 注入 || START
export async function createTabsForPlatforms(data: SyncData) {
  const tabs: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }[] = [];
  let groupId: number | undefined;

  for (const info of data.platforms) {
    let tab: chrome.tabs.Tab | null = null;
    if (info) {
      const extraConfig = info.extraConfig as { customInjectUrls?: string[] };
      if (extraConfig?.customInjectUrls && extraConfig.customInjectUrls.length > 0) {
        for (const url of extraConfig.customInjectUrls) {
          tab = await chrome.tabs.create({ url });
          info.injectUrl = url;
          // 等待标签页加载完成
          await new Promise<void>((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab!.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });
        }
      } else {
        if (info.name === "DYNAMIC_REDDIT" && hasRedditSubreddit(info)) {
          tab = await chrome.tabs.create({ url: getRedditSubmitUrl(info) });
        } else if (info.name === "DYNAMIC_LINKEDIN" && hasLinkedinCompanyId(info)) {
          // 同步覆盖 injectUrl，保证后续"重新发布"等重载逻辑仍使用公司页地址
          info.injectUrl = getLinkedinCompanyUrl(info);
          tab = await chrome.tabs.create({ url: info.injectUrl });
        } else if (info.injectUrl) {
          tab = await chrome.tabs.create({ url: info.injectUrl });
        } else {
          const platformInfo = infoMap[info.name];
          if (platformInfo) {
            tab = await chrome.tabs.create({ url: platformInfo.injectUrl });
          }
        }
        // 等待标签页加载完成
        if (tab) {
          await injectScriptsToTabs([{ tab, platformInfo: info }], data);
          await chrome.tabs.update(tab.id!, { active: true });
          tabs.push({
            tab,
            platformInfo: info,
          });

          // 如果是第一个标签页，创建一个新组
          if (!groupId) {
            groupId = await chrome.tabs.group({ tabIds: [tab.id!] });
            await chrome.tabGroups.update(groupId, {
              color: "blue",
              title: `MultiPost-${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
            });
          } else {
            // 将新标签页添加到现有组中
            await chrome.tabs.group({ tabIds: [tab.id!], groupId });
          }
          // 等待3秒再继续
          await new Promise<void>((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab!.id && info.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  return tabs;
}

export async function injectScriptsToTabs(
  tabs: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }[],
  data: SyncData,
) {
  for (const t of tabs) {
    const tab = t.tab;
    const platform = t.platformInfo;
    if (tab.id) {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          getPlatformInfo(platform.name).then((info) => {
            if (info) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: info.injectFunction,
                args: [data],
              });
            }
          });
        }
      });
    }
  }
}
// Inject || 注入 || END
