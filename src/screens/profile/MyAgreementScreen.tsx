import React from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import ContractScreen from '../onboarding/ContractScreen';

const MyAgreementScreen: React.FC = () => {
  const { userProfile } = useAuthContext();

  const signedDate = userProfile?.contractSignedAt
    ? userProfile.contractSignedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : undefined;

  return (
    <ContractScreen
      readOnly
      signedName={userProfile?.displayName}
      signedDate={signedDate}
    />
  );
};

export default MyAgreementScreen;
