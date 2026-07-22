import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Alert,
  alpha,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { authApi } from '../api/client';
import { setCredentials } from '../store/authSlice';
import { brand, signalGradient } from '../theme';

interface FormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { email: 'admin@errortracker.com', password: 'AdminPass123!' },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await authApi.login(data.email, data.password);
      const { user, tokens } = res.data.data;
      dispatch(
        setCredentials({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        })
      );
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Login failed';
      setError(msg);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: alpha('#fff', 0.05),
      color: '#fff',
      borderRadius: 1.5,
      '& fieldset': { borderColor: alpha('#fff', 0.14) },
      '&:hover fieldset': { borderColor: alpha('#fff', 0.28) },
      '&.Mui-focused fieldset': { borderColor: brand.magenta },
    },
    '& .MuiInputLabel-root': { color: alpha('#fff', 0.55) },
    '& .MuiInputLabel-root.Mui-focused': { color: brand.magentaSoft },
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
        bgcolor: brand.ink,
      }}
    >
      {/* Brand panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 5,
          position: 'relative',
          overflow: 'hidden',
          borderRight: `1px solid ${alpha('#fff', 0.06)}`,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(ellipse 70% 50% at 20% 10%, ${alpha(brand.magenta, 0.28)} 0%, transparent 55%),
              radial-gradient(ellipse 50% 40% at 90% 80%, ${alpha(brand.cobalt, 0.22)} 0%, transparent 50%)
            `,
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
            <Box
              component="img"
              src="/isaii-logo.png"
              alt=""
              sx={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 1, bgcolor: '#fff', p: 0.5 }}
            />
            <Box>
              <Typography sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 22, color: '#fff', letterSpacing: '-0.03em' }}>
                Isaii AI
              </Typography>
              <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, letterSpacing: '0.16em', color: alpha('#fff', 0.45) }}>
                ERROR TRACKER
              </Typography>
            </Box>
          </Box>
          <Typography
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: { md: 40, lg: 48 },
              letterSpacing: '-0.04em',
              lineHeight: 1.08,
              color: '#fff',
              maxWidth: 420,
            }}
          >
            See every failure before your users do.
          </Typography>
          <Box sx={{ width: 88, height: 3, background: signalGradient, mt: 3, borderRadius: 1 }} />
          <Typography sx={{ mt: 3, color: alpha('#fff', 0.58), maxWidth: 380, lineHeight: 1.6 }}>
            Monitor errors, triage tickets, and keep projects healthy from one console.
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ position: 'relative', zIndex: 1, color: alpha('#fff', 0.35), fontFamily: '"IBM Plex Mono", monospace' }}>
          isaii.in · monitoring console
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 4 },
          position: 'relative',
        }}
      >
        <Box
          aria-hidden
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(ellipse 80% 40% at 50% 0%, ${alpha(brand.magenta, 0.35)} 0%, transparent 55%)
            `,
          }}
        />
        <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1, px: 0 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.25, mb: 4 }}>
            <Box
              component="img"
              src="/isaii-logo.png"
              alt="Isaii AI"
              sx={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 1, bgcolor: '#fff', p: 0.4 }}
            />
            <Typography sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>
              Isaii AI
            </Typography>
          </Box>

          <Typography
            variant="overline"
            sx={{ color: alpha('#fff', 0.45), display: 'block', mb: 1 }}
          >
            Sign in
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: '-0.03em',
              color: '#fff',
              mb: 0.75,
            }}
          >
            Welcome back
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.55), mb: 3.5 }}>
            Use your workspace credentials to continue.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField label="Email" type="email" fullWidth required {...register('email')} sx={fieldSx} />
            <TextField label="Password" type="password" fullWidth required {...register('password')} sx={fieldSx} />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ mt: 0.5, py: 1.4, fontSize: 15, borderRadius: 1.5 }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
