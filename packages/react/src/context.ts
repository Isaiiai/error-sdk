import { createContext } from 'react';
import type ErrorTracker from '@error-tracker/js-sdk';

export const ErrorTrackerContext = createContext<ErrorTracker | null>(null);
