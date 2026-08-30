import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { Plus, Settings } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { getExtraConfig, saveExtraConfig } from "~sync/extraconfig";

interface RedditConfig {
  selectedSubreddit: string;
  historySubreddits: string[];
}

interface RedditProps {
  platformKey: string;
}

export default function DynamicReddit({ platformKey }: RedditProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>("");
  const [newSubreddit, setNewSubreddit] = useState("");

  useEffect(() => {
    // 加载已保存的 subreddit 配置
    const loadConfig = async () => {
      const config = await getExtraConfig<RedditConfig>(platformKey);
      if (config) {
        if (config.historySubreddits.length > 0) {
          setSubreddits(config.historySubreddits);
        }
        if (config.selectedSubreddit) {
          setSelectedSubreddit(config.selectedSubreddit);
        }
      }
    };
    loadConfig();
  }, [platformKey]);

  const handleAddSubreddit = () => {
    const value = newSubreddit.trim().replace(/^r\//i, "");
    if (value && !subreddits.includes(value)) {
      setSubreddits([...subreddits, value]);
      setNewSubreddit("");
    }
  };

  const handleSelectSubreddit = (value: string) => {
    setSelectedSubreddit(value === selectedSubreddit ? "" : value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddSubreddit();
    }
  };

  const handleSave = async () => {
    await saveExtraConfig<RedditConfig>(platformKey, {
      selectedSubreddit,
      historySubreddits: subreddits,
    });
    setIsOpen(false);
  };

  return (
    <>
      <Button variant="light" size="sm" onPress={() => setIsOpen(true)} className="flex items-center gap-1">
        <Settings className="w-4 h-4" />
        {selectedSubreddit ? `r/${selectedSubreddit}` : chrome.i18n.getMessage("extraConfigRedditSelectSubreddit")}
      </Button>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="md" placement="center" backdrop="blur">
        <ModalContent>
          <ModalHeader>{chrome.i18n.getMessage("extraConfigRedditConfigureSubreddit")}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={chrome.i18n.getMessage("extraConfigRedditEnterSubredditName")}
                  value={newSubreddit}
                  onChange={(e) => setNewSubreddit(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button
                  variant="light"
                  onPress={handleAddSubreddit}
                  isDisabled={!newSubreddit.trim() || subreddits.includes(newSubreddit.trim())}
                  className="flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  {chrome.i18n.getMessage("extraConfigRedditAdd")}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {subreddits.map((sub) => (
                  <Button
                    key={sub}
                    variant={sub === selectedSubreddit ? "solid" : "light"}
                    color={sub === selectedSubreddit ? "primary" : "default"}
                    onPress={() => handleSelectSubreddit(sub)}
                    className="flex-none">
                    r/{sub}
                  </Button>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsOpen(false)}>
              {chrome.i18n.getMessage("extraConfigRedditCancel")}
            </Button>
            <Button variant="solid" onPress={handleSave}>
              {chrome.i18n.getMessage("extraConfigRedditSaveConfig")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
