import React from "react";
import { Settings } from "lucide-react";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { useTranslations } from "next-intl";

interface GlobalInspectorProps {
  template: AssemblyTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<AssemblyTemplate>>;
}

export const GlobalInspector: React.FC<GlobalInspectorProps> = ({
  template,
  setTemplate,
}) => {
  const t = useTranslations("studio");

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-900 capitalize mb-1 flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-indigo-600" /> {t("globalProperties")}
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          {t("configureTemplate")}
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("templateName")}
        </label>
        <input
          type="text"
          value={template.name}
          onChange={(e) =>
            setTemplate((prev) => ({
              ...prev,
              name: e.target.value,
            }))
          }
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("descriptionOptional")}
        </label>
        <textarea
          value={template.description || ""}
          maxLength={200}
          onChange={(e) =>
            setTemplate((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
          placeholder={t("descriptionPlaceholder")}
        />
        <div className="text-[10px] text-right mt-1 text-gray-400">
          {(template.description || "").length}/200
        </div>
      </div>
    </div>
  );
};
