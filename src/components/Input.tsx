import React, { forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { tokens } from '../design';
import Text from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      prefix,
      suffix,
      containerStyle,
      inputStyle,
      editable = true,
      ...rest
    },
    ref,
  ) => {
    const isError = Boolean(error);

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text weight="medium" style={styles.label}>
            {label}
          </Text>
        )}

        <View
          style={[
            styles.inputWrapper,
            isError && styles.inputWrapperError,
            !editable && styles.inputWrapperDisabled,
          ]}
        >
          {prefix && <View style={styles.prefixContainer}>{prefix}</View>}

          <TextInput
            ref={ref}
            editable={editable}
            placeholderTextColor="#64748B"
            style={[styles.input, inputStyle]}
            {...rest}
          />

          {suffix && <View style={styles.suffixContainer}>{suffix}</View>}
        </View>

        {isError ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.md,
    width: '100%',
  },
  label: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#CBD5E1',
    marginBottom: tokens.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: tokens.spacing.md,
    minHeight: tokens.layout.buttonHeight,
  },
  inputWrapperError: {
    borderColor: tokens.colors.status.danger,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  inputWrapperDisabled: {
    opacity: 0.5,
  },
  prefixContainer: {
    marginRight: tokens.spacing.xs,
    justifyContent: 'center',
  },
  suffixContainer: {
    marginLeft: tokens.spacing.xs,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: tokens.typography.sizes.body,
    paddingVertical: tokens.spacing.sm,
  },
  hintText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#64748B',
    marginTop: tokens.spacing.xxs,
  },
  errorText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#F87171',
    marginTop: tokens.spacing.xxs,
  },
});

export default Input;
