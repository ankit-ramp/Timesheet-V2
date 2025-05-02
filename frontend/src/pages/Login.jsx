import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link
} from '@mui/material';
import toast, { Toaster } from 'react-hot-toast';
import { LockOpen, Email } from '@mui/icons-material';

const Login = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/auth/login', data);
      console.log(response)
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        console.log("response.data.token = ",response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user));
        toast.success('Login successful! Redirecting...');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Toaster position="top-center" reverseOrder={false} />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{
            backgroundColor: 'white',
            borderRadius: 4,
            p: 4,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            '&:hover': {
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.1)'
            }
          }}
        >
          <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 4
          }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <LockOpen sx={{ 
                fontSize: 56, 
                color: 'primary.main',
                bgcolor: 'rgba(63, 81, 181, 0.1)',
                p: 2,
                borderRadius: 3
              }} />
            </motion.div>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                mt: 3,
                mb: 1,
                fontWeight: 700, 
                color: 'text.primary',
                letterSpacing: '-0.5px'
              }}
            >
              Welcome Back
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Please sign in to continue
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              {...register('email', { required: 'Email is required' })}
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              InputProps={{
                startAdornment: <Email sx={{ color: 'action.active', mr: 1.5 }} />
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                }
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              {...register('password', { required: 'Password is required' })}
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              InputProps={{
                startAdornment: <LockOpen sx={{ color: 'action.active', mr: 1.5 }} />
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                  },
                }
              }}
            />

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
                size="large"
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 500,
                  mt: 2
                }}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </motion.div>

          </Box>
        </Box>
      </motion.div>
    </div>
  );
};

export default Login;

