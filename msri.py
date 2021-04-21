import matplotlib.pyplot as plt


class Mu:
    def __init__(self, mu):
        self.mu = mu
        self.history = []
        self.msr = []
        self.momentum = 0.9
        self.price = 1

    def market_shock_resistance(self, mu):
        msr_indicator = 2*mu/abs(1-mu**2)
        self.msr.append(msr_indicator)

    def next(self, alpha):
        self.price = self.price * alpha
        print(self.price)
        self.mu = (1 - self.momentum) * alpha + self.momentum * self.mu
        self.history.append(self.mu)
        self.market_shock_resistance(self.mu)


alpha = 0.5
mu = Mu(1)
steps = range(0, 100)
for i in steps:
    mu.next(alpha)
    alpha = 1.01

print(mu.history)
fig, ax1 = plt.subplots()

ax1.set_xlabel('step')
ax1.set_ylabel('mu', color='r')
ax1.plot(steps, mu.history, color='r')

ax2 = ax1.twinx()
ax2.set_ylabel('msri', color='b')
ax2.plot(steps, mu.msr, color='b')

plt.grid()
plt.show()
