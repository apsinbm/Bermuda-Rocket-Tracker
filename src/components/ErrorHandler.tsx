/**
 * Error Handler Component
 * Displays user-friendly error messages and recovery options
 */

import React, { useState, useEffect } from 'react';
import { EnhancedError, ErrorType } from '../services/errorHandlingService';

interface ErrorHandlerProps {
  error: EnhancedError | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

interface ErrorDisplayInfo {
  icon: string;
  title: string;
  message: string;
  actionText: string;
  severity: 'error' | 'warning' | 'info';
  canRetry: boolean;
}

const ErrorHandler: React.FC<ErrorHandlerProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [retryDisabled, setRetryDisabled] = useState(false);

  useEffect(() => {
    if (error) {
      setRetryAttempts(0);
      setRetryDisabled(false);
    }
  }, [error]);

  if (!error) return null;

  const getErrorDisplayInfo = (error: EnhancedError | Error): ErrorDisplayInfo => {
    if (error instanceof EnhancedError) {
      switch (error.type) {
        case ErrorType.NETWORK_ERROR:
          return {
            icon: '🌐',
            title: 'Connection Problem',
            message: error.userFriendlyMessage,
            actionText: 'Retry Connection',
            severity: 'error',
            canRetry: true
          };

        case ErrorType.RATE_LIMIT:
          return {
            icon: '⏰',
            title: 'Rate Limited',
            message: error.userFriendlyMessage,
            actionText: 'Try Again Later',
            severity: 'warning',
            canRetry: true
          };

        case ErrorType.TIMEOUT:
          return {
            icon: '⏳',
            title: 'Request Timeout',
            message: error.userFriendlyMessage,
            actionText: 'Retry Request',
            severity: 'warning',
            canRetry: true
          };

        case ErrorType.API_ERROR:
          if (error.statusCode === 503) {
            return {
              icon: '🔧',
              title: 'Service Maintenance',
              message: error.userFriendlyMessage,
              actionText: 'Check Again',
              severity: 'info',
              canRetry: true
            };
          }
          return {
            icon: '⚠️',
            title: 'Service Error',
            message: error.userFriendlyMessage,
            actionText: 'Try Again',
            severity: 'error',
            canRetry: error.isRetryable
          };

        case ErrorType.VALIDATION_ERROR:
          return {
            icon: '❌',
            title: 'Invalid Request',
            message: error.userFriendlyMessage,
            actionText: 'Refresh Page',
            severity: 'error',
            canRetry: false
          };

        default:
          return {
            icon: '🚨',
            title: 'Unexpected Error',
            message: error.userFriendlyMessage,
            actionText: 'Try Again',
            severity: 'error',
            canRetry: false
          };
      }
    }

    // Generic Error fallback
    return {
      icon: '❌',
      title: 'Error',
      message: error.message || 'An unexpected error occurred',
      actionText: 'Try Again',
      severity: 'error',
      canRetry: true
    };
  };

  const displayInfo = getErrorDisplayInfo(error);

  const handleRetry = async () => {
    if (!onRetry || retryDisabled) return;

    setRetryAttempts(prev => prev + 1);
    setRetryDisabled(true);

    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    }

    // Re-enable retry after a delay
    setTimeout(() => {
      setRetryDisabled(false);
    }, 2000);
  };

  const getSeverityClasses = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          icon: 'text-red-500',
          title: 'text-red-800 dark:text-red-200',
          message: 'text-red-700 dark:text-red-300',
          button: 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-500',
          title: 'text-yellow-800 dark:text-yellow-200',
          message: 'text-yellow-700 dark:text-yellow-300',
          button: 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700'
        };
      case 'info':
        return {
          container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          icon: 'text-blue-500',
          title: 'text-blue-800 dark:text-blue-200',
          message: 'text-blue-700 dark:text-blue-300',
          button: 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700'
        };
      default:
        return {
          container: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
          icon: 'text-gray-500',
          title: 'text-gray-800 dark:text-gray-200',
          message: 'text-gray-700 dark:text-gray-300',
          button: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
        };
    }
  };

  const classes = getSeverityClasses(displayInfo.severity);

  return (
    <div className={`rounded-lg border p-4 ${classes.container} ${className}`}>
      <div className="flex items-start">
        <div className={`text-xl mr-3 ${classes.icon}`}>
          {displayInfo.icon}
        </div>

        <div className="flex-1">
          <h3 className={`text-sm font-medium ${classes.title}`}>
            {displayInfo.title}
          </h3>
          
          <p className={`text-sm mt-1 ${classes.message}`}>
            {displayInfo.message}
          </p>

          {retryAttempts > 0 && (
            <p className={`text-xs mt-1 ${classes.message} opacity-75`}>
              Retry attempts: {retryAttempts}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {displayInfo.canRetry && onRetry && (
              <button
                onClick={handleRetry}
                disabled={retryDisabled}
                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${classes.button} ${
                  retryDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {retryDisabled ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent mr-1"></div>
                    Retrying...
                  </>
                ) : (
                  displayInfo.actionText
                )}
              </button>
            )}

            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${classes.button}`}
              >
                Dismiss
              </button>
            )}

            {showDetails && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${classes.button}`}
              >
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>

          {/* Error details (expanded) */}
          {isExpanded && error instanceof EnhancedError && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              <div className="text-xs space-y-1">
                <div><strong>Type:</strong> {error.type}</div>
                {error.statusCode && (
                  <div><strong>Status Code:</strong> {error.statusCode}</div>
                )}
                {error.details.retryAfter && (
                  <div><strong>Retry After:</strong> {error.details.retryAfter}s</div>
                )}
                <div><strong>Timestamp:</strong> {new Date(error.details.timestamp).toLocaleString()}</div>
                {error.details.context && (
                  <div>
                    <strong>Context:</strong>
                    <pre className="mt-1 text-xs bg-black bg-opacity-10 p-2 rounded overflow-x-auto">
                      {JSON.stringify(error.details.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`ml-2 ${classes.icon} hover:opacity-75`}
            title="Close"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorHandler;

/**
 * Global Error Boundary Component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error }> }>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ComponentType<{ error: Error }> }>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} />;
      }

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <ErrorHandler
              error={this.state.error}
              onRetry={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              showDetails={process.env.NODE_ENV === 'development'}
              className="w-full"
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}