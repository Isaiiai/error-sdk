import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  Alert,
  Link,
  MenuItem,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { authApi } from '../api/client';

interface FormData {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { role: 'developer' },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await authApi.register(data);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Registration failed';
      setError(msg);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background:
          'radial-gradient(ellipse at 20% 20%, #1A5C4533 0%, transparent 50%), linear-gradient(160deg, #F3F1EC, #E0D9CC)',
      }}
    >
      <Container maxWidth="xs">
        <Paper sx={{ p: 4 }} elevation={0}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 0.5 }}>
            Create account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Join ErrorTracker to track projects and errors
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>Account created — redirecting…</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Full name" required {...register('fullName')} />
            <TextField label="Email" type="email" required {...register('email')} />
            <TextField
              label="Password"
              type="password"
              required
              helperText="Min 12 chars with upper, lower, number, special"
              {...register('password')}
            />
            <TextField select label="Role" defaultValue="developer" {...register('role')}>
              <MenuItem value="developer">Developer</MenuItem>
              <MenuItem value="product_manager">Product Manager</MenuItem>
            </TextField>
            <Typography variant="caption" color="text.secondary">
              Admin accounts are provisioned by the platform team.
            </Typography>
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              Register
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">Sign in</Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
