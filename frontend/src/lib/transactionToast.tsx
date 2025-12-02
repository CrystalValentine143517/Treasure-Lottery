import { toast as sonnerToast } from 'sonner';
import { ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

export const getExplorerUrl = (hash: string) => {
    return `${SEPOLIA_EXPLORER}/tx/${hash}`;
};

export const shortenHash = (hash: string) => {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

interface ToastWithLinkProps {
    title: string;
    description?: string;
    hash?: string;
    type: 'success' | 'error' | 'loading' | 'info';
}

const ToastContent = ({ title, description, hash, type }: ToastWithLinkProps) => {
    const Icon = type === 'success' ? CheckCircle :
                 type === 'error' ? XCircle :
                 type === 'loading' ? Loader2 : null;

    const iconColor = type === 'success' ? 'text-green-500' :
                      type === 'error' ? 'text-red-500' :
                      type === 'loading' ? 'text-blue-500' : 'text-gray-500';

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                {Icon && <Icon className={`w-4 h-4 ${iconColor} ${type === 'loading' ? 'animate-spin' : ''}`} />}
                <span className="font-medium">{title}</span>
            </div>
            {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {hash && (
                <a
                    href={getExplorerUrl(hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 transition-colors mt-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span>View on Explorer: {shortenHash(hash)}</span>
                    <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </div>
    );
};

export const transactionToast = {
    pending: (hash: string, message: string = 'Transaction submitted') => {
        return sonnerToast.custom(
            () => (
                <ToastContent
                    title={message}
                    description="Waiting for confirmation..."
                    hash={hash}
                    type="loading"
                />
            ),
            {
                duration: Infinity,
                id: hash,
            }
        );
    },

    success: (hash: string, message: string = 'Transaction confirmed') => {
        sonnerToast.dismiss(hash);
        return sonnerToast.custom(
            () => (
                <ToastContent
                    title={message}
                    description="Transaction completed successfully"
                    hash={hash}
                    type="success"
                />
            ),
            {
                duration: 5000,
                id: `${hash}-success`,
            }
        );
    },

    error: (hash: string | undefined, message: string = 'Transaction failed', errorMsg?: string) => {
        if (hash) {
            sonnerToast.dismiss(hash);
        }
        return sonnerToast.custom(
            () => (
                <ToastContent
                    title={message}
                    description={errorMsg || 'Please try again'}
                    hash={hash}
                    type="error"
                />
            ),
            {
                duration: 5000,
                id: hash ? `${hash}-error` : undefined,
            }
        );
    },

    info: (message: string, description?: string) => {
        return sonnerToast.info(message, {
            description,
            duration: 3000,
        });
    },

    dismiss: (hash: string) => {
        sonnerToast.dismiss(hash);
    },
};

export const toast = {
    success: (message: string, description?: string) => {
        return sonnerToast.success(message, { description, duration: 3000 });
    },
    error: (message: string, description?: string) => {
        return sonnerToast.error(message, { description, duration: 4000 });
    },
    info: (message: string, description?: string) => {
        return sonnerToast.info(message, { description, duration: 3000 });
    },
    warning: (message: string, description?: string) => {
        return sonnerToast.warning(message, { description, duration: 3000 });
    },
    loading: (message: string) => {
        return sonnerToast.loading(message);
    },
    dismiss: (id?: string | number) => {
        sonnerToast.dismiss(id);
    },
};
