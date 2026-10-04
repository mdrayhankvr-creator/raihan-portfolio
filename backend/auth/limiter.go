package auth

import (
	"sync"
	"time"
)

type bucket struct {
	attempts int
	resets   time.Time
}
type loginLimiter struct {
	mu     sync.Mutex
	ips    map[string]bucket
	global bucket
}

func newLimiter() *loginLimiter { return &loginLimiter{ips: make(map[string]bucket)} }
func (l *loginLimiter) allow(ip string, now time.Time) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	// Expired buckets are removed; cap memory even if many source addresses appear.
	for key, b := range l.ips {
		if !now.Before(b.resets) {
			delete(l.ips, key)
		}
	}
	b, exists := l.ips[ip]
	if !exists {
		if len(l.ips) >= 10000 {
			return false, 60
		}
		b = bucket{resets: now.Add(time.Minute)}
	}
	if !now.Before(l.global.resets) {
		l.global = bucket{resets: now.Add(time.Minute)}
	}
	if b.attempts >= 5 || l.global.attempts >= 30 {
		reset := b.resets
		if l.global.attempts >= 30 {
			reset = l.global.resets
		}
		return false, max(1, int(reset.Sub(now).Seconds())+1)
	}
	b.attempts++
	l.ips[ip] = b
	l.global.attempts++
	return true, 0
}
