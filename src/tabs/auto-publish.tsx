import "~style.css";
import cssText from "data-text:~style.css";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  HeroUIProvider,
  Image,
  Input,
  Switch,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";
import { BotIcon, FileImageIcon, HandIcon, SendIcon, TrashIcon, XIcon } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PlatformCheckbox from "~components/Sync/PlatformCheckbox";
import { ACCOUNT_INFO_STORAGE_KEY } from "~sync/account";
import { type FileData, type PlatformInfo, type SyncData, getPlatformInfos } from "~sync/common";
import { EXTRA_CONFIG_STORAGE_KEY } from "~sync/extraconfig";

const storage = new Storage({
  area: "local",
});
const STORAGE_KEY = "autoPublishPlatforms";

export function getShadowContainer() {
  return document.querySelector("#test-shadow").shadowRoot.querySelector("#plasmo-shadow-container");
}

export const getShadowHostId = () => "test-shadow";

export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = cssText;
  return style;
};

interface FormState {
  title: string;
  content: string;
  images: FileData[];
  selectedPlatforms: string[];
  autoPublish: boolean;
}

export default function AutoPublish() {
  const [formState, setFormState] = useState<FormState>({
    title: "",
    content: "",
    images: [],
    selectedPlatforms: [],
    autoPublish: true,
  });
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  const storageInstance = useMemo(() => new Storage({ area: "local" }), []);
  const [accountInfos] = useStorage({
    key: ACCOUNT_INFO_STORAGE_KEY,
    instance: storageInstance,
  });
  const [extraConfigMap] = useStorage({
    key: EXTRA_CONFIG_STORAGE_KEY,
    instance: storageInstance,
  });

  const handleFileProcess = useCallback(
    (file: File): FileData => ({
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
    }),
    [],
  );

  // 加载已保存的平台选择
  useEffect(() => {
    storage.get<string[]>(STORAGE_KEY).then((saved) => {
      if (Array.isArray(saved)) {
        setFormState((prev) => ({ ...prev, selectedPlatforms: saved }));
      }
    });
  }, []);

  // 加载平台信息
  useEffect(() => {
    const loadPlatformInfos = async () => {
      try {
        const infos = await getPlatformInfos("DYNAMIC");
        setPlatforms(infos);
      } catch (error) {
        console.error("加载平台信息失败:", error);
      }
    };
    loadPlatformInfos();
  }, [accountInfos, extraConfigMap]);

  const getSyncData = (): SyncData => ({
    platforms: formState.selectedPlatforms.map((platform) => ({
      name: platform,
      injectUrl: platforms.find((p) => p.name === platform)?.injectUrl || "",
      extraConfig: platforms.find((p) => p.name === platform)?.extraConfig || {},
    })),
    data: {
      title: formState.title,
      content: formState.content,
      images: formState.images,
      videos: [],
    },
    isAutoPublish: formState.autoPublish,
  });

  // 文件选择
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files;
      if (!selectedFiles) return;
      const newFiles = Array.from(selectedFiles)
        .filter((file) => file.type.startsWith("image/"))
        .map(handleFileProcess);
      setFormState((prev) => ({ ...prev, images: [...prev.images, ...newFiles] }));
      event.target.value = "";
    },
    [handleFileProcess],
  );

  // 粘贴图片
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      Array.from(items).forEach((item) => {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file?.type.startsWith("image/")) {
            setFormState((prev) => ({ ...prev, images: [...prev.images, handleFileProcess(file)] }));
          }
        }
      });
    },
    [handleFileProcess],
  );

  // 拖放图片
  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer?.files;
      if (!files) return;
      const imageFiles = Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map(handleFileProcess);
      setFormState((prev) => ({ ...prev, images: [...prev.images, ...imageFiles] }));
    },
    [handleFileProcess],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    const dropArea = dropAreaRef.current;
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    dropArea?.addEventListener("dragover", handleDragOver);
    dropArea?.addEventListener("drop", handleDrop);
    return () => {
      document.removeEventListener("paste", handlePaste);
      dropArea?.removeEventListener("dragover", handleDragOver);
      dropArea?.removeEventListener("drop", handleDrop);
    };
  }, [handlePaste, handleDrop]);

  // 单个平台选择
  const handlePlatformChange = useCallback(async (platform: string, isSelected: boolean) => {
    setFormState((prev) => {
      const next = isSelected
        ? [...prev.selectedPlatforms, platform]
        : prev.selectedPlatforms.filter((p) => p !== platform);
      storage.set(STORAGE_KEY, next);
      return { ...prev, selectedPlatforms: next };
    });
  }, []);

  // 按分组批量选择
  const handleSelectAllInGroup = useCallback(
    async (tag: string) => {
      const groupPlatforms = platforms.filter((p) => p.tags?.includes(tag)).map((p) => p.name);
      setFormState((prev) => {
        const next = Array.from(new Set([...prev.selectedPlatforms, ...groupPlatforms]));
        storage.set(STORAGE_KEY, next);
        return { ...prev, selectedPlatforms: next };
      });
    },
    [platforms],
  );

  // 按分组批量清空
  const handleClearGroup = useCallback(
    async (tag: string) => {
      const groupPlatforms = platforms.filter((p) => p.tags?.includes(tag)).map((p) => p.name);
      setFormState((prev) => {
        const next = prev.selectedPlatforms.filter((p) => !groupPlatforms.includes(p));
        storage.set(STORAGE_KEY, next);
        return { ...prev, selectedPlatforms: next };
      });
    },
    [platforms],
  );

  const handleDeleteImage = useCallback((index: number) => {
    setFormState((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  }, []);

  const handleClearAll = useCallback(async () => {
    setFormState((prev) => ({ ...prev, title: "", content: "", images: [], selectedPlatforms: [], autoPublish: true }));
    await storage.set(STORAGE_KEY, []);
  }, []);

  // 触发自动发布
  const handlePublish = async () => {
    if (!formState.content) {
      alert(chrome.i18n.getMessage("optionsEnterDynamicContent"));
      return;
    }
    if (formState.selectedPlatforms.length === 0) {
      alert(chrome.i18n.getMessage("optionsSelectPublishPlatforms"));
      return;
    }

    const data = getSyncData();
    setIsPublishing(true);
    setNotice(chrome.i18n.getMessage("autoPublishTriggered"));
    try {
      await storage.set(STORAGE_KEY, formState.selectedPlatforms);
      chrome.runtime.sendMessage({ action: "MULTIPOST_EXTENSION_PUBLISH", data });
      // 发布弹窗由 background 打开，此页面稍后自动关闭
      setTimeout(() => window.close(), 1500);
    } catch (error) {
      console.error("触发自动发布失败:", error);
      setIsPublishing(false);
      setNotice(null);
    }
  };

  const renderPlatformGroup = (tag: "CN" | "International") => {
    const groupPlatforms = platforms.filter((platform) => platform.tags?.includes(tag));
    const selectedInGroup = formState.selectedPlatforms.filter((name) => groupPlatforms.some((p) => p.name === name));
    return (
      <Card className="shadow-none bg-default-50">
        <CardHeader className="flex items-center justify-between pb-0">
          <div className="flex items-center gap-2">
            <div className="w-8">
              <Icon
                icon={tag === "CN" ? "openmoji:flag-china" : "openmoji:globe-with-meridians"}
                className="w-full h-max"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {chrome.i18n.getMessage(tag === "CN" ? "optionsCNPlatforms" : "optionsInternationalPlatforms")}
              </span>
              <span className="text-xs text-default-500">
                {selectedInGroup.length}/{groupPlatforms.length}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="flat" onPress={() => handleSelectAllInGroup(tag)}>
              {chrome.i18n.getMessage("autoPublishSelectAll")}
            </Button>
            <Button size="sm" variant="light" color="danger" onPress={() => handleClearGroup(tag)}>
              {chrome.i18n.getMessage("optionsClearAll")}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-2">
            {groupPlatforms.map((platform) => (
              <PlatformCheckbox
                key={platform.name}
                platformInfo={platform}
                isSelected={formState.selectedPlatforms.includes(platform.name)}
                onChange={(_, isSelected) => handlePlatformChange(platform.name, isSelected)}
                syncData={getSyncData()}
              />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <HeroUIProvider>
      <div className="flex flex-col items-center min-h-screen p-4 bg-background">
        <div className="w-full max-w-3xl space-y-4">
          <h1 className="text-xl font-semibold text-center text-foreground">
            {chrome.i18n.getMessage("autoPublishPageTitle")}
          </h1>
          {notice && <p className="text-sm text-center text-primary-600">{notice}</p>}

          <div className="flex flex-col gap-4" ref={dropAreaRef}>
            <Card className="shadow-none bg-default-50">
              <CardHeader>
                <Input
                  isClearable
                  variant="underlined"
                  label={chrome.i18n.getMessage("optionsEnterDynamicTitle")}
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  onClear={() => setFormState((prev) => ({ ...prev, title: "" }))}
                  className="w-full"
                />
              </CardHeader>
              <CardBody>
                <Textarea
                  isClearable
                  label={chrome.i18n.getMessage("optionsEnterDynamicContent")}
                  value={formState.content}
                  onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                  variant="underlined"
                  minRows={6}
                  className="w-full"
                  autoFocus
                  onClear={() => setFormState((prev) => ({ ...prev, content: "" }))}
                />
              </CardBody>
              <CardFooter>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={imageInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      multiple
                    />
                    <Button isIconOnly variant="light" onPress={() => imageInputRef.current?.click()} title="添加图片">
                      <FileImageIcon className="size-5" />
                    </Button>
                    <span className="text-xs text-default-500">{chrome.i18n.getMessage("autoPublishImageHint")}</span>
                  </div>
                  {(formState.title || formState.content || formState.images.length > 0) && (
                    <Button isIconOnly variant="light" color="danger" onPress={handleClearAll}>
                      <TrashIcon className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>

            {formState.images.length > 0 && (
              <Card className="shadow-none bg-default-50">
                <CardBody className="flex flex-row flex-wrap items-start justify-start gap-3 p-4">
                  {formState.images.map((file, index) => (
                    <div key={index} className="relative group">
                      <Image
                        src={file.url}
                        alt={file.name}
                        width={100}
                        height={100}
                        className="object-cover rounded-lg"
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        color="danger"
                        variant="light"
                        className="absolute z-50 transition-opacity duration-200 opacity-0 top-1 right-1 group-hover:opacity-100"
                        onPress={() => handleDeleteImage(index)}>
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <Switch
                isSelected={formState.autoPublish}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, autoPublish: value }))}
                startContent={<BotIcon className="size-4" />}
                endContent={<HandIcon className="size-4" />}>
                {chrome.i18n.getMessage("optionsAutoPublish")}
              </Switch>
              <span className="text-xs text-default-500">
                {chrome.i18n.getMessage("autoPublishCount", [formState.selectedPlatforms.length.toString()])}
              </span>
            </div>

            {renderPlatformGroup("CN")}
            {renderPlatformGroup("International")}

            <Button
              onPress={handlePublish}
              color="primary"
              variant="flat"
              isDisabled={!formState.content || formState.selectedPlatforms.length === 0 || isPublishing}
              className="w-full font-medium shadow-none">
              <SendIcon className="mr-2 size-4" />
              {chrome.i18n.getMessage("autoPublishPublish")}
            </Button>
          </div>
        </div>
      </div>
    </HeroUIProvider>
  );
}
