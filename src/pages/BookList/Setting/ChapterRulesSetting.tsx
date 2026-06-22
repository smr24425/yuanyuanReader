import React, { useMemo, useState } from "react";
import {
  List,
  Button,
  Dialog,
  Input,
  Toast,
  Picker,
  Popup,
  Space,
} from "antd-mobile";
import {
  BUILTIN_CHAPTER_RULE_DESCRIPTIONS,
  CHAPTER_RULE_TYPE_OPTIONS,
  formatRulePreview,
  getRuleSummary,
  type ChapterRuleType,
  type CustomChapterRule,
} from "../../../utils/chapterRuleCompiler";
import {
  getCustomChapterRules,
  MAX_CUSTOM_CHAPTER_RULES,
  setCustomChapterRules,
  validateNewChapterRulePrefix,
} from "../../../utils/storage";
import "./ChapterRulesSetting.scss";

const ChapterRulesSetting: React.FC = () => {
  const [rules, setRules] = useState<CustomChapterRule[]>(() =>
    getCustomChapterRules(),
  );
  const [addVisible, setAddVisible] = useState(false);
  const [ruleType, setRuleType] = useState<ChapterRuleType>("prefix-digits");
  const [prefix, setPrefix] = useState("");
  const [pickerVisible, setPickerVisible] = useState(false);

  const previewText = useMemo(
    () =>
      formatRulePreview({
        id: "preview",
        type: ruleType,
        prefix,
      }),
    [ruleType, prefix],
  );

  const selectedTypeLabel =
    CHAPTER_RULE_TYPE_OPTIONS.find((item) => item.value === ruleType)?.label ??
    "";

  const persistRules = (nextRules: CustomChapterRule[]) => {
    setCustomChapterRules(nextRules);
    setRules(nextRules);
  };

  const resetAddForm = () => {
    setRuleType("prefix-digits");
    setPrefix("");
  };

  const closeAddForm = () => {
    setAddVisible(false);
    resetAddForm();
  };

  const handleAddRule = () => {
    const error = validateNewChapterRulePrefix(prefix);
    if (error) {
      Toast.show({ content: error, icon: "fail" });
      return;
    }
    if (rules.length >= MAX_CUSTOM_CHAPTER_RULES) {
      Toast.show({
        content: `最多只能新增 ${MAX_CUSTOM_CHAPTER_RULES} 條規則`,
        icon: "fail",
      });
      return;
    }

    const nextRule: CustomChapterRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: ruleType,
      prefix: prefix.trim(),
    };
    persistRules([...rules, nextRule]);
    Toast.show({ content: "規則已新增", icon: "success" });
    closeAddForm();
  };

  const handleDeleteRule = async (rule: CustomChapterRule) => {
    const confirmed = await Dialog.confirm({
      content: `確定刪除「${getRuleSummary(rule)}」嗎？`,
      confirmText: "刪除",
      cancelText: "取消",
    });
    if (!confirmed) return;
    persistRules(rules.filter((item) => item.id !== rule.id));
    Toast.show({ content: "規則已刪除", icon: "success" });
  };

  return (
    <>
      <List header="章節切分規則">
        <List.Item description="新規則僅套用至之後上傳的 TXT；已存在的書請重新上傳。">
          使用說明
        </List.Item>

        <List.Item
          description={
            <div className="chapter-rules-setting__builtin-list">
              {BUILTIN_CHAPTER_RULE_DESCRIPTIONS.map((desc) => (
                <div key={desc}>{desc}</div>
              ))}
            </div>
          }
        >
          內建規則
        </List.Item>

        <List.Item
          description={`已新增 ${rules.length} / ${MAX_CUSTOM_CHAPTER_RULES} 條`}
        >
          我的規則
        </List.Item>

        {rules.map((rule) => (
          <List.Item
            key={rule.id}
            className="chapter-rules-setting__rule-item"
            description={
              <div className="chapter-rules-setting__rule-meta">
                <span className="chapter-rules-setting__rule-preview">
                  {formatRulePreview(rule)}
                </span>
                <button
                  type="button"
                  className="chapter-rules-setting__delete-btn"
                  onClick={() => void handleDeleteRule(rule)}
                >
                  刪除
                </button>
              </div>
            }
          >
            {getRuleSummary(rule)}
          </List.Item>
        ))}

        <List.Item
          clickable
          arrow
          disabled={rules.length >= MAX_CUSTOM_CHAPTER_RULES}
          onClick={() => setAddVisible(true)}
        >
          新增章節切分規則
        </List.Item>
      </List>

      <Popup
        visible={addVisible}
        onMaskClick={closeAddForm}
        position="bottom"
        className="chapter-rules-setting__add-popup"
        bodyStyle={{
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        <div className="chapter-rules-setting__form">
          <div className="chapter-rules-setting__form-title">新增章節切分規則</div>

          <List>
            <List.Item
              onClick={() => setPickerVisible(true)}
              clickable
              arrow
              extra={
                <span className="chapter-rules-setting__type-value">
                  {selectedTypeLabel}
                </span>
              }
            >
              規則類型
            </List.Item>
          </List>

          <div className="chapter-rules-setting__input-wrap">
            <Input
              placeholder="請輸入關鍵字，例如 EP、Episode、序章"
              value={prefix}
              onChange={setPrefix}
              clearable
            />
          </div>

          <div className="chapter-rules-setting__preview">{previewText}</div>

          <Space
            block
            direction="vertical"
            className="chapter-rules-setting__form-actions"
          >
            <Button block color="primary" onClick={handleAddRule}>
              儲存
            </Button>
            <Button block onClick={closeAddForm}>
              取消
            </Button>
          </Space>
        </div>
      </Popup>

      <Picker
        columns={[CHAPTER_RULE_TYPE_OPTIONS.map((item) => item.label)]}
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onConfirm={(value) => {
          const label = value[0] as string;
          const matched = CHAPTER_RULE_TYPE_OPTIONS.find(
            (item) => item.label === label,
          );
          if (matched) setRuleType(matched.value);
        }}
      />
    </>
  );
};

export default ChapterRulesSetting;
