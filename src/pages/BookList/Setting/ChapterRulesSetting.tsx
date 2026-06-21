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
import { UnorderedListOutline } from "antd-mobile-icons";
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
    setAddVisible(false);
    resetAddForm();
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
    <div className="chapter-rules-setting">
      <List header="章節切分規則">
        <List.Item prefix={<UnorderedListOutline />}>
          <div className="chapter-rules-setting__notice">
            新規則僅套用至<strong>之後上傳</strong>的 TXT；已存在的書請重新上傳。
          </div>
        </List.Item>
      </List>

      <List header="內建規則（自動套用）">
        {BUILTIN_CHAPTER_RULE_DESCRIPTIONS.map((desc) => (
          <List.Item key={desc}>{desc}</List.Item>
        ))}
      </List>

      <List
        header={`我的規則（${rules.length}/${MAX_CUSTOM_CHAPTER_RULES}）`}
      >
        {rules.length === 0 ? (
          <List.Item>尚未新增自訂規則</List.Item>
        ) : (
          rules.map((rule) => (
            <List.Item
              key={rule.id}
              description={formatRulePreview(rule)}
              extra={
                <Button
                  size="mini"
                  color="danger"
                  fill="outline"
                  onClick={() => void handleDeleteRule(rule)}
                >
                  刪除
                </Button>
              }
            >
              {getRuleSummary(rule)}
            </List.Item>
          ))
        )}
      </List>

      <div className="chapter-rules-setting__actions">
        <Button
          block
          color="primary"
          onClick={() => setAddVisible(true)}
          disabled={rules.length >= MAX_CUSTOM_CHAPTER_RULES}
        >
          新增章節切分規則
        </Button>
      </div>

      <Popup
        visible={addVisible}
        onMaskClick={() => {
          setAddVisible(false);
          resetAddForm();
        }}
        bodyStyle={{
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          padding: 16,
        }}
      >
        <div className="chapter-rules-setting__form">
          <h3>新增章節切分規則</h3>

          <List>
            <List.Item
              onClick={() => setPickerVisible(true)}
              clickable
              extra={selectedTypeLabel}
            >
              規則類型
            </List.Item>
            <List.Item>
              <Input
                placeholder="請輸入關鍵字，例如 EP、Episode、序章"
                value={prefix}
                onChange={setPrefix}
                clearable
              />
            </List.Item>
          </List>

          <div className="chapter-rules-setting__preview">{previewText}</div>

          <Space block direction="vertical" style={{ "--gap": "12px" }}>
            <Button block color="primary" onClick={handleAddRule}>
              儲存
            </Button>
            <Button
              block
              onClick={() => {
                setAddVisible(false);
                resetAddForm();
              }}
            >
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
    </div>
  );
};

export default ChapterRulesSetting;
