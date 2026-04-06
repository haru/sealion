'use client';

import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { type MessageData, AUTO_DISMISS_DURATION, DISPLAY_CONSTRAINTS } from '@/components/types';

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
    if (reason === 'clickaway') { return; }
    setOpen(false);
    onClose(message.id);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      anchorOrigin={DISPLAY_CONSTRAINTS.displayPosition}
      onClose={handleClose}
    >
      <Alert
        severity={getSeverity(message.type)}
        sx={{
          width: { xs: 'calc(100vw - 32px)', sm: 'auto' },
          maxWidth: { xs: 'calc(100vw - 32px)', sm: 640 },
          minWidth: { sm: 480 },
        }}
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
        <Box component="span" sx={{ display: "block", whiteSpace: "pre-line" }}>
          {message.message}
        </Box>
      </Alert>
    </Snackbar>
  );
}
