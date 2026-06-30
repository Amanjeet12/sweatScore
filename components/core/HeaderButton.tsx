import { Pressable, PressableProps, StyleSheet } from 'react-native';

type HeaderButtonProps = PressableProps & {
  minWidth?: number;
};

export const HeaderButton = ({
  children,
  hitSlop,
  minWidth = 48,
  style,
  ...props
}: HeaderButtonProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={hitSlop ?? { top: 8, bottom: 8, left: 8, right: 8 }}
      style={(state) => [
        styles.button,
        { minWidth },
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
