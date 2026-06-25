"use client";

import React, { useState } from "react";
import { ticketService, Ticket } from "../../src/lib/services/ticketService";
import { ErrorHandler } from "../../src/lib/utils/errorHandler";

interface TicketCheckInButtonProps {
    ticket: Ticket;
    onCheckInSuccess: () => void;
}

export default function TicketCheckInButton({ ticket, onCheckInSuccess }: TicketCheckInButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheckIn = async () => {
        if (isLoading) return;
        setError(null);
        setIsLoading(true);

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            setIsLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await ticketService.checkIn(ticket.id!, ticket.version || 1, latitude, longitude);
                    onCheckInSuccess();
                } catch (err: unknown) {
                    console.error("Check-in error:", err);
                    setError(ErrorHandler.format(err, "Failed to check in."));
                } finally {
                    setIsLoading(false);
                }
            },
            (geoError) => {
                console.error("Geolocation error:", geoError);
                let errorMessage = "Failed to get location. Please allow location access.";
                if (geoError.code === geoError.PERMISSION_DENIED) {
                    errorMessage = "Location access denied. Please enable location permissions.";
                } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
                    errorMessage = "Location information is unavailable.";
                } else if (geoError.code === geoError.TIMEOUT) {
                    errorMessage = "Location request timed out. Please try again.";
                }
                setError(errorMessage);
                setIsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    if (ticket.status !== 'assigned') {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 w-full">
            {error && <p className="text-red-500 text-[10px] font-bold">{error}</p>}
            <button
                onClick={(e) => {
                    e.stopPropagation(); // prevent opening the ticket modal if this is on the card
                    handleCheckIn();
                }}
                disabled={isLoading}
                className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all shadow-sm ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95"}`}
            >
                {isLoading ? "Checking in..." : "📍 Check-in to Start"}
            </button>
        </div>
    );
}
