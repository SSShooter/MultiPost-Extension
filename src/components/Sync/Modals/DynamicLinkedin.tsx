import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { parseLinkedinCompanyId } from "../../../sync/common";
import { getExtraConfig, saveExtraConfig } from "../../../sync/extraconfig";

interface LinkedinConfig {
  companyId: string;
}

interface LinkedinProps {
  platformKey: string;
}

export default function DynamicLinkedin({ platformKey }: LinkedinProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getExtraConfig<LinkedinConfig>(platformKey);
      if (config?.companyId) {
        setCompanyId(config.companyId);
      }
    };
    loadConfig();
  }, [platformKey]);

  const handleSave = async () => {
    await saveExtraConfig<LinkedinConfig>(platformKey, {
      companyId: parseLinkedinCompanyId(companyId),
    });
    setIsOpen(false);
  };

  const displayId = parseLinkedinCompanyId(companyId);

  return (
    <>
      <Button variant="light" size="sm" onPress={() => setIsOpen(true)} className="flex items-center gap-1">
        <Settings className="w-4 h-4" />
        {displayId
          ? chrome.i18n.getMessage("extraConfigLinkedinCompanyPrefix") + displayId
          : chrome.i18n.getMessage("extraConfigLinkedinSelectCompany")}
      </Button>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="md" placement="center" backdrop="blur">
        <ModalContent>
          <ModalHeader>{chrome.i18n.getMessage("extraConfigLinkedinConfigureCompany")}</ModalHeader>
          <ModalBody>
            <Input
              placeholder={chrome.i18n.getMessage("extraConfigLinkedinEnterCompanyId")}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              onClear={() => setCompanyId("")}
              isClearable
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsOpen(false)}>
              {chrome.i18n.getMessage("extraConfigLinkedinCancel")}
            </Button>
            <Button variant="solid" onPress={handleSave}>
              {chrome.i18n.getMessage("extraConfigLinkedinSaveConfig")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
