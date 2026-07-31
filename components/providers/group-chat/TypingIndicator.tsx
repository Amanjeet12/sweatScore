import { Text } from "~/components/ui/text";

type TypingIndicatorProps = {
  label?: string;
  fallbackText: string;
};

const TypingIndicator = ({ label, fallbackText }: TypingIndicatorProps) => (
  <Text
    className="font-body text-xs"
    style={{ color: label ? "#F35E16" : "#777777" }}
    numberOfLines={1}
  >
    {label || fallbackText}
  </Text>
);

export default TypingIndicator;
