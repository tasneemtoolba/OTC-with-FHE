import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OTCDemo from '../OTCDemo';

// Mock the MetaMask hook
vi.mock('@/hooks/metamask/useMetaMaskEthersSigner', () => ({
    useMetaMaskEthersSigner: () => ({
        ethersSigner: null,
        isConnected: false,
        connect: vi.fn(),
    }),
}));

// Mock the order events hook
vi.mock('@/hooks/useOrderEvents', () => ({
    useOrderEvents: () => ({
        events: [],
        loading: false,
        error: null,
        addEvent: vi.fn(),
        getEventsByOrderId: vi.fn(),
        getEventsByType: vi.fn(),
    }),
}));

describe('OTCDemo', () => {
    const mockProps = {
        otcAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        tokenIn: '0xTokenA123456789012345678901234567890123456' as `0x${string}`,
        tokenOut: '0xTokenB123456789012345678901234567890123456' as `0x${string}`,
    };

    it('renders without crashing', () => {
        render(<OTCDemo {...mockProps} />);
        expect(screen.getByText('Confidential OTC Escrow Demo')).toBeInTheDocument();
    });

    it('displays contract information', () => {
        render(<OTCDemo {...mockProps} />);
        expect(screen.getByText(/Contract:/)).toBeInTheDocument();
        expect(screen.getByText(/Token In:/)).toBeInTheDocument();
        expect(screen.getByText(/Token Out:/)).toBeInTheDocument();
    });

    it('shows all tab buttons', () => {
        render(<OTCDemo {...mockProps} />);
        expect(screen.getByText('➕ Create Order')).toBeInTheDocument();
        expect(screen.getByText('💱 Fill Order')).toBeInTheDocument();
        expect(screen.getByText('📋 Orders')).toBeInTheDocument();
        expect(screen.getByText('🔍 Reveal & Audit')).toBeInTheDocument();
    });

    it('shows how it works section', () => {
        render(<OTCDemo {...mockProps} />);
        expect(screen.getByText('How It Works')).toBeInTheDocument();
        expect(screen.getByText('1. Create Order')).toBeInTheDocument();
        expect(screen.getByText('2. Fill Order')).toBeInTheDocument();
        expect(screen.getByText('3. Reveal & Audit')).toBeInTheDocument();
    });
});
