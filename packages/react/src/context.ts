import { createContext } from 'react';
import type ErrorTracker from '@isaiiai/error-trackers-js-sdk';

export const ErrorTrackerContext = createContext<ErrorTracker | null>(null);
