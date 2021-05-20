import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits import mplot3d

density = 0.01
ceiling = 2

fig = plt.figure()
ax = plt.axes(projection='3d')
ax.set_xlabel('A')
ax.set_xticks([])
ax.set_ylabel('B')
ax.set_yticks([])
ax.set_zlabel('SEN')
ax.set_zticks([])


x = np.arange(density, ceiling+density, density)
y = np.arange(density, ceiling+density, density)


x, y = np.meshgrid(x, y)
z = 1/(x*y)

x = x.flatten()
y = y.flatten()
z = z.flatten()
mask = z <= ceiling
x = x[mask]
y = y[mask]
z = z[mask]

ax.plot_trisurf(x, y, z, cmap='viridis', edgecolor='none')

plt.show()
