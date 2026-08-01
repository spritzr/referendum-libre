import React from 'react';
import { View, Text, TouchableOpacity, LayoutChangeEvent, Platform, Image } from 'react-native';
import { PortalHost } from 'react-native-teleport';
import { useCameraPermission } from 'react-native-vision-camera';
import { createStepSpecificStyles } from './styles';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/constants/theme';
import { FlowStep } from '@/constants/voting-flow-steps';
import { stepVideoHostName } from './stepVideoHostName';

interface StepDocumentScanStartProps {
  onStartAnalysis?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  isPassportFlow?: boolean;
}

const StepDocumentScanStart: React.FC<StepDocumentScanStartProps> = ({ onStartAnalysis, onLayout, isPassportFlow = false }) => {
  const { t } = useTranslation();
  const docSfx = isPassportFlow ? 'passport' : 'idCard';
  const colors = useColors();
  const stepSpecificStyles = createStepSpecificStyles(colors);
  const { hasPermission, requestPermission } = useCameraPermission();

  const handleStartAnalysis = async () => {
    console.log('🔘 StepDocumentScanStart: Start analysis pressed, hasPermission:', hasPermission);

    // Request camera permission before proceeding
    if (!hasPermission) {
      console.log('📸 StepDocumentScanStart: Requesting camera permission...');
      const granted = await requestPermission();
      console.log('📸 StepDocumentScanStart: Permission result:', granted);

      if (!granted) {
        // Permission denied - stay on this step
        console.log('❌ StepDocumentScanStart: Camera permission denied');
        return;
      }
    }

    // Permission granted or already had it - proceed to next step
    console.log('✅ StepDocumentScanStart: Permission OK, proceeding to next step');
    onStartAnalysis?.();
  };

  return (
    <View style={[{ width: '100%' }]} onLayout={onLayout}>
      <View style={stepSpecificStyles.stepDocumentScanStartContainer}>
        <View style={stepSpecificStyles.stepDocumentScanStartContent}>
          <Text style={stepSpecificStyles.stepDocumentScanStartTitle}>{t(`voting.step4Title_${docSfx}`)}</Text>
        </View>
        {Platform.OS === 'android' ? (
          <Image
            // poster-passport.png is currently a placeholder copy of
            // poster-card.png — see StepIntroConsent.tsx for the same TODO.
            source={isPassportFlow
              ? require('@/assets/images/poster-passport.png')
              : require('@/assets/images/poster-card.png')}
            style={stepSpecificStyles.stepDocumentScanStartVideo}
            resizeMode="cover"
          />
        ) : (
          <PortalHost
            name={stepVideoHostName(FlowStep.DocumentScanStart)}
            style={stepSpecificStyles.stepDocumentScanStartVideo}
          />
        )}
        <TouchableOpacity
          style={stepSpecificStyles.stepDocumentScanStartButton}
          activeOpacity={0.8}
          onPress={handleStartAnalysis}
        >
          <Text style={stepSpecificStyles.stepDocumentScanStartButtonText}>{t('voting.step4Start')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StepDocumentScanStart;
