'use client';

import { useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslations } from 'next-intl';
import { MessageData, AUTO_DISMISS_DURATION, DISPLAY_CONSTRAINTS } from '@/components/types';

/**
 * Message Snackbar Props
 */
interface MessageSnackbarProps {
  message: MessageData;
  onClose: (id: string) => void;
}

/**
 * Maps message type to MUI Alert severity
 */
const getSeverity = (type: MessageData['type']): 'info' | 'warning' | 'error' => {
  switch (type) {
    case 'information':
      return 'info';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
  }
};

/**
 * Message Snackbar Component
 *
 * Renders individual messages using MUI Snackbar and Alert.
 * Handles auto-dismiss based on message type.
 *
 * @param props - Message data and close callback
 */
export default function MessageSnackbar({ message, onClose }: MessageSnackbarProps) {
  const t = useTranslations('message');
  const [open, setOpen] = useState(true);

  // Get auto-dismiss duration based on message type
  const autoHideDuration = AUTO_DISMISS_DURATION[message.type];

  const handleClose = (_event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
    onClose(message.id);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      anchorOrigin={DISPLAY_CONSTRAINTS.displayPosition}
      onClose={handleClose}
      sx={{
        '& .MuiSnackbar-root': {
          top: '16px',
        },
      }}
    >
      <Alert
        severity={getSeverity(message.type)}
        action={
          <IconButton
            size="small"
            onClick={handleClose}
            aria-label={t('close')}
            sx={{ color: 'inherit' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {message.message}
      </Alert>
    </Snackbar>
  );
}
